import * as THREE from 'three';

export interface StableKeyInfo {
  stableKey: string;
  type: 'uuid' | 'name' | 'path';
  pathKey?: string;
}

/**
 * 为 mesh 生成稳定的唯一标识
 * 优先级：uuid > name > pathKey
 */
export function generateStableKey(
  mesh: THREE.Object3D,
  path: string[]
): StableKeyInfo {
  // 1. 尝试使用 uuid
  if (mesh.uuid) {
    return {
      stableKey: mesh.uuid,
      type: 'uuid',
    };
  }

  // 2. 尝试使用 name（排除通用名称）
  if (mesh.name && !['Mesh', 'Group', 'Scene', 'Object3D'].includes(mesh.name)) {
    return {
      stableKey: mesh.name,
      type: 'name',
    };
  }

  // 3. 使用 pathKey（遍历路径）
  const pathKey = path.join('/');
  return {
    stableKey: pathKey,
    type: 'path',
    pathKey,
  };
}

/**
 * 为整个场景生成 stableKey 映射表
 */
export function generateStableKeyMap(
  root: THREE.Object3D
): Map<THREE.Object3D, StableKeyInfo> {
  const map = new Map<THREE.Object3D, StableKeyInfo>();
  const path: string[] = [];

  function traverse(obj: THREE.Object3D) {
    path.push(obj.name || `${obj.type}_${path.length}`);

    // 为每个对象生成 stableKey
    const info = generateStableKey(obj, [...path]);
    map.set(obj, info);

    // 存储到 userData 以便快速查询
    (obj as any).__stableKey = info.stableKey;

    for (const child of obj.children) {
      traverse(child);
    }

    path.pop();
  }

  traverse(root);
  return map;
}

/**
 * 从 mesh 查找 stableKey
 */
export function getStableKey(mesh: THREE.Object3D): string | null {
  return (mesh as any).__stableKey || null;
}

/**
 * 从 stableKey 查找 mesh
 */
export function findMeshByStableKey(
  root: THREE.Object3D,
  stableKey: string
): THREE.Object3D | null {
  let result: THREE.Object3D | null = null;

  root.traverse((obj) => {
    if ((obj as any).__stableKey === stableKey) {
      result = obj;
    }
  });

  return result;
}

/**
 * 生成 modelId（基于文件名、大小、修改时间的哈希）
 */
export function generateModelId(file: File): string {
  const key = `${file.name}|${file.size}|${file.lastModified}`;
  return hashString(key);
}

/**
 * 简单的字符串哈希函数
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
