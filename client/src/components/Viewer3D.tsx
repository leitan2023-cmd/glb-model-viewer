import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { getObjectCenter, getObjectSize } from '@/lib/glbLoader';
import { CameraManager } from '@/lib/cameraManager';
import { PickingManager, PickResult } from '@/lib/pickingUtils';
import { TreeNode, findNodeById } from '@/lib/sceneGraph';

export interface Viewer3DProps {
  scene: THREE.Group | null;
  sceneTree?: TreeNode | null;
  onReady?: (viewer: Viewer3DInstance) => void;
  onPickObject?: (pickResult: PickResult | null, debugInfo?: any) => void;
}

export interface Viewer3DInstance {
  camera: THREE.Camera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  cameraManager: CameraManager;
  pickingManager: PickingManager;
  fitToModel: () => void;
  fitToObject: (object: THREE.Object3D) => void;
  fitToObjectSmooth: (object: THREE.Object3D, duration?: number) => void;
  resetView: () => void;
  generateThumbnail: (width?: number, height?: number) => Promise<string>;
  dispose: () => void;
}

const Viewer3D: React.FC<Viewer3DProps> = ({ scene, sceneTree, onReady, onPickObject }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer3DInstance | null>(null);
  const sceneTreeRef = useRef<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 当 sceneTree 更新时，更新 ref（不重新创建 renderer）
  useEffect(() => {
    sceneTreeRef.current = sceneTree || null;
    console.log('[viewer] sceneTree updated in ref');
  }, [sceneTree]);

  // 仅在 scene 首次加载时初始化 renderer（不依赖 sceneTree）
  useEffect(() => {
    if (!containerRef.current || !scene) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 创建场景
    const mainScene = new THREE.Scene();
    mainScene.background = new THREE.Color(0x0f1419);

    // 创建相机
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    camera.position.set(0, 0, 100);

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    // 创建控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = false;
    controls.enableZoom = true;
    controls.enablePan = true;

    // 创建相机管理器
    const cameraManager = new CameraManager(camera as THREE.PerspectiveCamera, controls);

    // 创建拾取管理器
    const pickingManager = new PickingManager();

    // 添加灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    mainScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    mainScene.add(directionalLight);

    // 辅助灯光
    const backLight = new THREE.DirectionalLight(0x8899ff, 0.3);
    backLight.position.set(-10, -5, -10);
    mainScene.add(backLight);

    // 创建 viewer 实例
    const viewer: Viewer3DInstance = {
      camera,
      scene: mainScene,
      renderer,
      controls,
      cameraManager,
      pickingManager,
      fitToModel: () => {
        if (scene && scene.children.length > 0) {
          viewer.fitToObject(scene);
        }
      },
      fitToObject: (obj: THREE.Object3D) => {
        const size = getObjectSize(obj);
        const center = getObjectCenter(obj);
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5;

        camera.position.copy(center);
        camera.position.z += cameraZ;
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();
      },
      fitToObjectSmooth: (obj: THREE.Object3D, duration: number = 400) => {
        cameraManager.frameObjectSmooth(obj, { duration, padding: 1.5 });
      },
      resetView: () => {
        cameraManager.resetView({ duration: 400 });
      },
      generateThumbnail: async (width: number = 256, height: number = 256) => {
        const originalWidth = renderer.domElement.width;
        const originalHeight = renderer.domElement.height;
        const originalPixelRatio = renderer.getPixelRatio();
        try {
          renderer.setSize(width, height);
          renderer.setPixelRatio(1);
          if (camera instanceof THREE.PerspectiveCamera) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
          }
          renderer.render(mainScene, camera);
          const dataUrl = renderer.domElement.toDataURL('image/png');
          return dataUrl;
        } catch (error) {
          console.error('Failed to generate thumbnail:', error);
          return '';
        } finally {
          renderer.setSize(originalWidth, originalHeight);
          renderer.setPixelRatio(originalPixelRatio);
          if (camera instanceof THREE.PerspectiveCamera) {
            camera.aspect = originalWidth / originalHeight;
            camera.updateProjectionMatrix();
          }
          renderer.render(mainScene, camera);
        }
      },
      dispose: () => {
        renderer.dispose();
        controls.dispose();
        cameraManager.dispose();
        pickingManager.dispose();
        container.removeChild(renderer.domElement);
      },
    };

    viewerRef.current = viewer;
    onReady?.(viewer);

    // ===== 最小可验证的拾取实现 =====
    
    // 单例：raycaster、mouse、pickables
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pickables: THREE.Object3D[] = [];

    // 状态：pointerdown 位置和时间
    let downX = 0, downY = 0, downT = 0;

    // 收集 pickables（仅加载完成一次）
    function collectPickables(root: THREE.Object3D) {
      pickables = [];
      root.traverse((o: any) => {
        if (o.isMesh) pickables.push(o);
      });
      console.log('[pick] pickables:', pickables.length);
    }

    // 执行拾取
    function doPick(e: PointerEvent) {
      const canvas = renderer.domElement;
      const rect = canvas.getBoundingClientRect();

      // 计算 NDC
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      console.log('[pick] rect', {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
      console.log('[pick] ndc', mouse.x, mouse.y);
      console.log('[pick] pickables', pickables.length);

      // Raycaster 交集测试
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(pickables, true);

      console.log('[pick] hits', hits.length, hits[0]?.object?.name);

      // 初始化 Debug 信息
      const debugInfo = {
        pickablesCount: pickables.length,
        lastDownX: downX,
        lastDownY: downY,
        lastNDCX: mouse.x,
        lastNDCY: mouse.y,
        hitsCount: hits.length,
        hitName: '',
        hitUUID: '',
        mappedTreeId: '',
      };

      if (!hits.length) {
        console.log('[pick] no intersection');
        onPickObject?.(null, debugInfo);
        renderer.render(mainScene, camera);
        return;
      }

      // 获取命中的 mesh
      const hitMesh = hits[0].object as THREE.Mesh;
      console.log('[pick] hit name:', hitMesh.name, 'uuid:', hitMesh.uuid);

      debugInfo.hitName = hitMesh.name;
      debugInfo.hitUUID = hitMesh.uuid;

      // 沿 parent 向上查找最近的 treeId
      let obj: any = hitMesh;
      let foundTreeId: string | null = null;

      while (obj) {
        if (obj.userData?.treeId) {
          foundTreeId = obj.userData.treeId;
          console.log('[pick] mapped treeId:', foundTreeId);
          debugInfo.mappedTreeId = foundTreeId || '';
          break;
        }
        obj = obj.parent;
      }

      if (!foundTreeId) {
        console.log('[pick] no treeId found in ancestors');
        onPickObject?.(null, debugInfo);
        renderer.render(mainScene, camera);
        return;
      }

      // 根据 treeId 在树中查找对应的节点（使用 ref 中的最新 sceneTree）
      let pickedNode: TreeNode | null = null;
      const currentSceneTree = sceneTreeRef.current;
      if (currentSceneTree) {
        pickedNode = findNodeById(currentSceneTree, foundTreeId);
        console.log('[pick] found tree node:', pickedNode?.name);
      } else {
        console.log('[pick] sceneTree is null, cannot find node');
      }

      // 构建 PickResult
      const pickResult: PickResult = {
        mesh: hitMesh,
        point: hits[0].point,
        distance: hits[0].distance,
        node: pickedNode,
      };

      console.log('[pick] calling onPickObject with result:', pickResult);
      onPickObject?.(pickResult, debugInfo);

      // 强制渲染一帧
      renderer.render(mainScene, camera);
    }

    // 绑定事件到 canvas
    const canvas = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
      console.log('[pick] pointerdown', { x: downX, y: downY });
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;

      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      const dist2 = dx * dx + dy * dy;
      const dt = performance.now() - downT;

      console.log('[pick] pointerup', { dx, dy, dist2, dt });

      // 阈值：距离小于 5px，且不是长按
      if (dist2 > 25 || dt > 500) {
        console.log('[pick] treated as drag, skipping pick');
        return;
      }

      doPick(e);
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });
    console.log('[pick] bound to canvas', canvas);

    // 添加加载的场景
    mainScene.add(scene);
    collectPickables(scene);
    if (sceneTreeRef.current) {
      pickingManager.setScene(scene, sceneTreeRef.current);
    }
    viewer.fitToModel();

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(mainScene, camera);
    };
    animate();

    // 处理窗口调整
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      viewer.dispose();
    };
  }, [scene, onReady, onPickObject]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-background relative"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-foreground">加载中...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Viewer3D;
