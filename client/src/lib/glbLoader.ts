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
    // 使用多个 CDN 备选地址
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    dracoLoader.setDecoderConfig({ type: 'js' }); // 使用 JS 解码器，兼容性更好
  }
  return dracoLoader;
}

function getGLTFLoader(): GLTFLoader {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();
    const draco = getDRACOLoader();
    gltfLoader.setDRACOLoader(draco);
  }
  return gltfLoader;
}

/**
 * 加载 GLB/GLTF 文件
 * 支持 .glb（二进制）和 .gltf（JSON）格式
 */
export async function loadGLB(
  file: File,
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (!result) {
          reject(new Error('文件读取结果为空'));
          return;
        }

        const loader = getGLTFLoader();
        const isGLTF = file.name.toLowerCase().endsWith('.gltf');

        if (isGLTF) {
          // GLTF 是 JSON 文本格式
          const text = result as string;
          try {
            JSON.parse(text); // 验证 JSON 是否合法
          } catch {
            reject(new Error('无效的 GLTF 文件：JSON 解析失败'));
            return;
          }

          loader.parse(
            text,
            '', // 资源路径（无外部引用时为空）
            (gltf: any) => {
              resolve({ scene: gltf.scene, gltf });
            },
            (error: any) => {
              reject(new Error(`GLTF 解析失败: ${error?.message || '未知错误'}`));
            }
          );
        } else {
          // GLB 是二进制格式
          const arrayBuffer = result as ArrayBuffer;

          // 校验 GLB 文件魔数 (0x46546C67 = "glTF")
          if (arrayBuffer.byteLength < 12) {
            reject(new Error('文件太小，不是有效的 GLB 文件'));
            return;
          }

          const headerView = new DataView(arrayBuffer);
          const magic = headerView.getUint32(0, true);
          if (magic !== 0x46546C67) {
            reject(new Error('无效的 GLB 文件：文件头校验失败（非 glTF 格式）'));
            return;
          }

          loader.parse(
            arrayBuffer,
            '',
            (gltf: any) => {
              resolve({ scene: gltf.scene, gltf });
            },
            (error: any) => {
              reject(new Error(`GLB 解析失败: ${error?.message || '未知错误'}`));
            }
          );
        }
      } catch (error) {
        reject(new Error(`文件处理异常: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error(`文件读取失败: ${reader.error?.message || '未知错误'}`));
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

    // 根据文件类型选择读取方式
    if (file.name.toLowerCase().endsWith('.gltf')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
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

