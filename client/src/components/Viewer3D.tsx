import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
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
 camera: THREE.PerspectiveCamera;
 scene: THREE.Scene;
 renderer: THREE.WebGLRenderer;
 labelRenderer: CSS2DRenderer;
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

 // 用 ref 保持回调最新引用，避免放入 useEffect 依赖
 const onReadyRef = useRef(onReady);
 const onPickObjectRef = useRef(onPickObject);
 useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
 useEffect(() => { onPickObjectRef.current = onPickObject; }, [onPickObject]);

 // 当 sceneTree 更新时，更新 ref（不重新创建 renderer）
 useEffect(() => {
  sceneTreeRef.current = sceneTree || null;
 }, [sceneTree]);

 // 仅在 scene 首次加载时初始化 renderer（不依赖回调）
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
   preserveDrawingBuffer: true, // 支持截图
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制 pixelRatio 防止性能问题
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  // 创建 CSS2DRenderer（用于距离标签等）
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(width, height);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  // 创建控制器
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = false;
  controls.enableZoom = true;
  controls.enablePan = true;

  // 创建相机管理器
  const cameraManager = new CameraManager(camera, controls);

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

  const backLight = new THREE.DirectionalLight(0x8899ff, 0.3);
  backLight.position.set(-10, -5, -10);
  mainScene.add(backLight);

  // 创建 viewer 实例
  const viewer: Viewer3DInstance = {
   camera,
   scene: mainScene,
   renderer,
   labelRenderer,
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
    if (maxDim === 0) return; // 防止空模型

    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5;

    camera.position.copy(center);
    camera.position.z += cameraZ;
    camera.lookAt(center);
    controls.target.copy(center);

    // 自适应 near/far
    camera.near = Math.max(cameraZ / 1000, 0.01);
    camera.far = Math.max(cameraZ * 100, 2000);
    camera.updateProjectionMatrix();
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
     camera.aspect = width / height;
     camera.updateProjectionMatrix();
     renderer.render(mainScene, camera);
     const dataUrl = renderer.domElement.toDataURL('image/png');
     return dataUrl;
    } catch (error) {
     console.error('Failed to generate thumbnail:', error);
     return '';
    } finally {
     renderer.setSize(originalWidth, originalHeight);
     renderer.setPixelRatio(originalPixelRatio);
     camera.aspect = originalWidth / originalHeight;
     camera.updateProjectionMatrix();
     renderer.render(mainScene, camera);
    }
   },
   dispose: () => {
    renderer.dispose();
    controls.dispose();
    cameraManager.dispose();
    pickingManager.dispose();
    if (renderer.domElement.parentNode === container) {
     container.removeChild(renderer.domElement);
    }
    if (labelRenderer.domElement.parentNode === container) {
     container.removeChild(labelRenderer.domElement);
    }
   },
  };

  viewerRef.current = viewer;
  onReadyRef.current?.(viewer);

  // ===== 拾取逻辑 =====
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pickables: THREE.Object3D[] = [];

  let downX = 0, downY = 0, downT = 0;

  function collectPickables(root: THREE.Object3D) {
   pickables = [];
   root.traverse((o: any) => {
    if (o.isMesh) pickables.push(o);
   });
  }

  function doPick(e: PointerEvent) {
   const canvas = renderer.domElement;
   const rect = canvas.getBoundingClientRect();

   mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
   mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

   raycaster.setFromCamera(mouse, camera);
   const hits = raycaster.intersectObjects(pickables, true);

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
    onPickObjectRef.current?.(null, debugInfo);
    return;
   }

   const hitMesh = hits[0].object as THREE.Mesh;
   debugInfo.hitName = hitMesh.name;
   debugInfo.hitUUID = hitMesh.uuid;

   // 沿 parent 向上查找最近的 treeId
   let obj: any = hitMesh;
   let foundTreeId: string | null = null;

   while (obj) {
    if (obj.userData?.treeId) {
     foundTreeId = obj.userData.treeId;
     debugInfo.mappedTreeId = foundTreeId || '';
     break;
    }
    obj = obj.parent;
   }

   if (!foundTreeId) {
    onPickObjectRef.current?.(null, debugInfo);
    return;
   }

   // 根据 treeId 在树中查找对应的节点
   let pickedNode: TreeNode | null = null;
   const currentSceneTree = sceneTreeRef.current;
   if (currentSceneTree) {
    pickedNode = findNodeById(currentSceneTree, foundTreeId);
   }

   const pickResult: PickResult = {
    mesh: hitMesh,
    point: hits[0].point,
    distance: hits[0].distance,
    node: pickedNode,
   };

   onPickObjectRef.current?.(pickResult, debugInfo);
  }

  // 绑定事件到 canvas
  const canvas = renderer.domElement;

  const onPointerDown = (e: PointerEvent) => {
   if (e.button !== 0) return;
   downX = e.clientX;
   downY = e.clientY;
   downT = performance.now();
  };

  const onPointerUp = (e: PointerEvent) => {
   if (e.button !== 0) return;

   const dx = e.clientX - downX;
   const dy = e.clientY - downY;
   const dist2 = dx * dx + dy * dy;
   const dt = performance.now() - downT;

   // 阈值：距离小于 5px，且不是长按
   if (dist2 > 25 || dt > 500) return;

   doPick(e);
  };

  canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
  canvas.addEventListener('pointerup', onPointerUp, { passive: true });

  // 添加加载的场景
  mainScene.add(scene);
  collectPickables(scene);
  if (sceneTreeRef.current) {
   pickingManager.setScene(scene, sceneTreeRef.current);
  }
  viewer.fitToModel();

  // 动画循环
  let animFrameId: number;
  const animate = () => {
   animFrameId = requestAnimationFrame(animate);
   controls.update();
   renderer.render(mainScene, camera);
   labelRenderer.render(mainScene, camera); // 同步渲染标签
  };
  animate();

  // 处理窗口调整 - 同步更新两个 renderer
  const handleResize = () => {
   const newWidth = container.clientWidth;
   const newHeight = container.clientHeight;
   if (newWidth === 0 || newHeight === 0) return; // 防止容器隐藏时出错

   camera.aspect = newWidth / newHeight;
   camera.updateProjectionMatrix();
   renderer.setSize(newWidth, newHeight);
   labelRenderer.setSize(newWidth, newHeight);
  };

  window.addEventListener('resize', handleResize);

  // 初始触发一次 resize 确保尺寸正确
  handleResize();

  return () => {
   window.removeEventListener('resize', handleResize);
   canvas.removeEventListener('pointerdown', onPointerDown);
   canvas.removeEventListener('pointerup', onPointerUp);
   cancelAnimationFrame(animFrameId);
   viewer.dispose();
  };
 }, [scene]); // 只依赖 scene，不依赖回调函数

 return (
  <div
   ref={containerRef}
   className="w-full h-full bg-background relative"
   style={{ position: 'relative', overflow: 'hidden' }}
  />
 );
};

export default Viewer3D;

