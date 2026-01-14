import * as THREE from 'three';
import { nanoid } from 'nanoid';

export interface TreeNode {
  id: string;
  name: string;
  type: 'Group' | 'Mesh' | 'Light' | 'Camera' | 'Other';
  children: TreeNode[];
  object3D: THREE.Object3D;
  meshCount: number;
  triangleCount: number;
}

export interface NodeMap {
  [id: string]: TreeNode;
}

export interface Object3DMap {
  [id: string]: THREE.Object3D;
}

/**
 * 从 Three.js 场景生成树形结构
 */
export function generateSceneTree(scene: THREE.Group): TreeNode {
  const nodeMap: NodeMap = {};
  const object3DMap: Object3DMap = {};

  function traverse(object: THREE.Object3D, parent?: TreeNode): TreeNode {
    const nodeId = nanoid(8);
    let type: TreeNode['type'] = 'Other';
    let meshCount = 0;
    let triangleCount = 0;

    if (object instanceof THREE.Mesh) {
      type = 'Mesh';
      meshCount = 1;
      if (object.geometry) {
        const positionAttribute = object.geometry.getAttribute('position');
        if (positionAttribute) {
          triangleCount = positionAttribute.count / 3;
        }
      }
    } else if (object instanceof THREE.Group) {
      type = 'Group';
    } else if (object instanceof THREE.Light) {
      type = 'Light';
    } else if (object instanceof THREE.Camera) {
      type = 'Camera';
    }

    const node: TreeNode = {
      id: nodeId,
      name: object.name || `${type}_${nodeId.slice(0, 4)}`,
      type,
      children: [],
      object3D: object,
      meshCount,
      triangleCount,
    };

    nodeMap[nodeId] = node;
    object3DMap[nodeId] = object;
    // 在 Three.js 对象上存储 nodeId，便于反向查询
    (object as any).__nodeId = nodeId;

    for (const child of object.children) {
      const childNode = traverse(child, node);
      node.children.push(childNode);
      node.meshCount += childNode.meshCount;
      node.triangleCount += childNode.triangleCount;
    }

    return node;
  }

  const rootNode = traverse(scene);

  return rootNode;
}

/**
 * 从树节点获取所有 Mesh 对象
 */
export function getNodeMeshes(node: TreeNode): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  function traverse(n: TreeNode) {
    if (n.object3D instanceof THREE.Mesh) {
      meshes.push(n.object3D);
    }
    for (const child of n.children) {
      traverse(child);
    }
  }

  traverse(node);
  return meshes;
}

/**
 * 查找树节点
 */
export function findTreeNode(root: TreeNode, predicate: (node: TreeNode) => boolean): TreeNode | null {
  if (predicate(root)) {
    return root;
  }

  for (const child of root.children) {
    const found = findTreeNode(child, predicate);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * 获取节点的完整路径（从根到该节点）
 */
export function getNodePath(root: TreeNode, targetId: string): TreeNode[] | null {
  function traverse(node: TreeNode, path: TreeNode[]): TreeNode[] | null {
    path.push(node);
    if (node.id === targetId) {
      return path;
    }

    for (const child of node.children) {
      const result = traverse(child, [...path]);
      if (result) {
        return result;
      }
    }

    return null;
  }

  return traverse(root, []);
}

/**
 * 平铺树结构为数组（用于搜索）
 */
export function flattenTree(root: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];

  function traverse(node: TreeNode) {
    result.push(node);
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(root);
  return result;
}

/**
 * 搜索树节点（模糊匹配名称）
 */
export function searchTreeNodes(root: TreeNode, query: string): TreeNode[] {
  const lowerQuery = query.toLowerCase();
  const flattened = flattenTree(root);
  return flattened.filter((node) => node.name.toLowerCase().includes(lowerQuery));
}

/**
 * 根据 Object3D 查找对应的树节点
 */
export function findNodeByObject3D(root: TreeNode, object3D: THREE.Object3D): TreeNode | null {
  return findTreeNode(root, (node) => node.object3D === object3D);
}

/**
 * 根据 nodeId 查找树节点
 */
export function findNodeById(root: TreeNode, nodeId: string): TreeNode | null {
  return findTreeNode(root, (node) => node.id === nodeId);
}

/**
 * 从 Object3D 向上查找最近的有 nodeId 的父串
 * 用于拾取子 mesh 时定位到父节点
 */
export function findNearestNodeIdInAncestors(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  
  while (current) {
    const nodeId = (current as any).__nodeId;
    if (nodeId) {
      return nodeId;
    }
    current = current.parent;
  }
  
  return null;
}
