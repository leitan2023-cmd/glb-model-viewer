import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { getObjectCenter, getObjectSize } from '@/lib/glbLoader';
import { CameraManager } from '@/lib/cameraManager';
import { PickingManager, PickResult } from '@/lib/pickingUtils';

export interface Viewer3DProps {
  scene: THREE.Group | null;
  onReady?: (viewer: Viewer3DInstance) => void;
  onPickObject?: (pickResult: PickResult | null) => void;
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
  dispose: () => void;
}

const Viewer3D: React.FC<Viewer3DProps> = ({ scene, onReady, onPickObject }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer3DInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

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

    // 添加加载的场景
    if (scene) {
      mainScene.add(scene);
      pickingManager.setScene(scene, null); // sceneTree 会在 Home 组件中设置
      viewer.fitToModel();
    }

    // 处理鼠标点击拾取
    const handleMouseClick = (event: MouseEvent) => {
      // 只在左键点击时执行拾取
      if (event.button !== 0) return;

      const pickResult = pickingManager.pick(
        event.clientX,
        event.clientY,
        camera,
        container
      );

      onPickObject?.(pickResult);
    };

    renderer.domElement.addEventListener('click', handleMouseClick);

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
      renderer.domElement.removeEventListener('click', handleMouseClick);
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
