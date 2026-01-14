import * as THREE from 'three';
import { GLTFLoader, DRACOLoader } from 'three-stdlib';

export interface LoadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface LoadResult {
  scene: THREE.Group;
  gltf: any;
}

let gltfLoader: GLTFLoader | null = null;
let dracoLoader: DRACOLoader | null = null;

function getDRACOLoader(): DRACOLoader {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    // 设置 Draco 解码库的路径
    // 使用 Google 提供的 CDN 地址
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  }
  return dracoLoader;
}

function getGLTFLoader(): GLTFLoader {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();
    // 配置 DRACOLoader 以支持 Draco 压缩的 GLB 文件
    const draco = getDRACOLoader();
    gltfLoader.setDRACOLoader(draco);
  }
  return gltfLoader;
}

export async function loadGLB(
  file: File,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const loader = getGLTFLoader();

        loader.parse(
          arrayBuffer,
          '',
          (gltf: any) => {
            resolve({
              scene: gltf.scene,
              gltf,
            });
          },
          (error: any) => {
            reject(new Error(`Failed to parse GLB: ${error.message}`));
          }
        );
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

export function calculateBoundingBox(object: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  box.expandByObject(object);
  return box;
}

export function getObjectSize(object: THREE.Object3D): THREE.Vector3 {
  const box = calculateBoundingBox(object);
  return box.getSize(new THREE.Vector3());
}

export function getObjectCenter(object: THREE.Object3D): THREE.Vector3 {
  const box = calculateBoundingBox(object);
  const center = new THREE.Vector3();
  return box.getCenter(center);
}
