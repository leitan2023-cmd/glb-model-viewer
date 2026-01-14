import { TreeNode } from '@/lib/sceneGraph';

export interface ExportData {
  timestamp: string;
  selectedNodes: SelectedNodeInfo[];
}

export interface SelectedNodeInfo {
  id: string;
  name: string;
  type: string;
  path: string;
  meshCount: number;
  triangleCount: number;
}

/**
 * 获取节点的路径字符串
 */
export function getNodePathString(root: TreeNode, targetId: string): string {
  function findPath(node: TreeNode, target: string, currentPath: string[] = []): string[] | null {
    currentPath.push(node.name);
    if (node.id === target) {
      return currentPath;
    }

    for (const child of node.children) {
      const result = findPath(child, target, [...currentPath]);
      if (result) {
        return result;
      }
    }

    return null;
  }

  const path = findPath(root, targetId);
  return path ? path.join(' > ') : '';
}

/**
 * 导出选中节点为 JSON
 */
export function exportSelectedNodes(
  root: TreeNode,
  selectedNodeIds: string[]
): ExportData {
  const selectedNodes: SelectedNodeInfo[] = [];

  function findNode(node: TreeNode, targetId: string): TreeNode | null {
    if (node.id === targetId) return node;
    for (const child of node.children) {
      const found = findNode(child, targetId);
      if (found) return found;
    }
    return null;
  }

  for (const nodeId of selectedNodeIds) {
    const node = findNode(root, nodeId);
    if (node) {
      selectedNodes.push({
        id: node.id,
        name: node.name,
        type: node.type,
        path: getNodePathString(root, nodeId),
        meshCount: node.meshCount,
        triangleCount: node.triangleCount,
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    selectedNodes,
  };
}

/**
 * 下载 JSON 文件
 */
export function downloadJSON(data: ExportData, filename: string = 'selection.json'): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
