import * as THREE from 'three';
import { TreeNode } from './sceneGraph';

/**
 * 模型统计信息
 */
export interface ModelStats {
  meshes: number;
  triangles: number;
  materials: number;
  textures: number;
  fileSize: number;
  fileName: string;
}

/**
 * 历史记录条目
 */
export interface ModelHistoryEntry {
  id: string;
  name: string;
  originalFileName: string;
  size: number;
  uploadedAt: number;
  stats: {
    meshes: number;
    triangles: number;
    materials: number;
    textures: number;
  };
  thumbDataUrl: string;
  blobKey: string;
  lastAccessedAt: number;
}

/**
 * 递归释放 Material 及其纹理
 */
function disposeMaterial(material: THREE.Material): void {
  // 释放纹理
  Object.keys(material).forEach((key) => {
    const value = (material as any)[key];
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  });

  // 释放材质本身
  material.dispose();
}

/**
 * 递归遍历并释放所有 geometry/material/texture
 */
export function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    // 释放 geometry
    if (child instanceof THREE.Mesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }

      // 释放 material（可能是单个或数组）
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            disposeMaterial(mat);
          });
        } else {
          disposeMaterial(child.material);
        }
      }
    }

    // 释放 SkinnedMesh 的骨架
    if (child instanceof THREE.SkinnedMesh && child.skeleton) {
      child.skeleton.dispose();
    }
  });
}

/**
 * 清理旧模型并释放资源
 */
export function disposeOldModel(root: THREE.Object3D): void {
  // 1. 递归释放所有资源
  disposeObject3D(root);

  // 2. 从场景中移除
  if (root.parent) {
    root.parent.remove(root);
  }

  // 3. 清空引用
  root.clear();
}

/**
 * 计算模型统计信息
 */
export function calculateModelStats(
  root: THREE.Object3D,
  fileSize: number,
  fileName: string
): ModelStats {
  let meshCount = 0;
  let triangleCount = 0;
  const materialsSet = new Set<THREE.Material>();
  const texturesSet = new Set<THREE.Texture>();

  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshCount++;

      // 计算三角面数
      if (child.geometry) {
        const positionAttribute = child.geometry.getAttribute('position');
        if (positionAttribute) {
          triangleCount += positionAttribute.count / 3;
        }
      }

      // 收集材质和纹理
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            materialsSet.add(mat);
            collectTextures(mat, texturesSet);
          });
        } else {
          materialsSet.add(child.material);
          collectTextures(child.material, texturesSet);
        }
      }
    }
  });

  return {
    meshes: meshCount,
    triangles: Math.round(triangleCount),
    materials: materialsSet.size,
    textures: texturesSet.size,
    fileSize,
    fileName,
  };
}

/**
 * 从材质中收集纹理
 */
function collectTextures(material: THREE.Material, texturesSet: Set<THREE.Texture>): void {
  Object.keys(material).forEach((key) => {
    const value = (material as any)[key];
    if (value instanceof THREE.Texture) {
      texturesSet.add(value);
    }
  });
}

/**
 * 生成缩略图
 */
export async function generateThumbnail(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number = 256,
  height: number = 256
): Promise<string> {
  // 保存原始尺寸
  const originalWidth = renderer.domElement.width;
  const originalHeight = renderer.domElement.height;

  try {
    // 设置离屏 canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // 创建离屏 renderer
    const offscreenRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    offscreenRenderer.setSize(width, height);
    offscreenRenderer.setPixelRatio(1);

    // 调整相机宽高比
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    // 渲染缩略图
    offscreenRenderer.render(scene, camera);

    // 导出为 data URL
    const dataUrl = canvas.toDataURL('image/png');

    // 清理离屏 renderer
    offscreenRenderer.dispose();

    return dataUrl;
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    // 返回空白缩略图
    return '';
  } finally {
    // 恢复原始尺寸
    renderer.setSize(originalWidth, originalHeight);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = originalWidth / originalHeight;
      camera.updateProjectionMatrix();
    }
  }
}
