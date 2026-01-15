/**
 * 业务节点提升工具
 * 从 Raycaster 命中的 mesh 向上遍历，找到业务命名节点
 */

import * as THREE from 'three';

/**
 * 检查节点是否是"技术节点"（应该被跳过）
 */
function isTechnicalNode(node: THREE.Object3D): boolean {
  const name = node.name.toLowerCase();
  return (
    name.startsWith('mesh_') ||
    name.startsWith('node_') ||
    name.startsWith('scene') ||
    name === '' ||
    name === 'group'
  );
}

/**
 * 从 mesh 向上遍历，找到第一个业务命名节点
 */
export function resolveBusinessNode(mesh: THREE.Object3D): THREE.Object3D {
  let current = mesh;

  // 如果 mesh 本身不是技术节点，直接返回
  if (!isTechnicalNode(current)) {
    console.log('[business-node] resolved to', current.name);
    return current;
  }

  // 向上遍历，找到第一个业务节点
  while (current.parent) {
    current = current.parent;

    // 如果找到业务节点，返回
    if (!isTechnicalNode(current)) {
      console.log('[business-node] resolved to', current.name, 'from', mesh.name);
      return current;
    }
  }

  // 如果没找到，返回原始 mesh
  console.log('[business-node] no business node found, returning original', mesh.name);
  return mesh;
}

/**
 * 获取节点的完整路径（用于调试）
 */
export function getNodePath(node: THREE.Object3D): string {
  const path: string[] = [];
  let current: THREE.Object3D | null = node;

  while (current) {
    path.unshift(current.name || 'unnamed');
    current = current.parent;
  }

  return path.join(' > ');
}
