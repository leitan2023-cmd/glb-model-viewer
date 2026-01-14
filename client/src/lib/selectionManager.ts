import * as THREE from 'three';
import { TreeNode, getNodeMeshes } from '@/lib/sceneGraph';

export interface SelectionState {
  selectedNodeId: string | null;
  selectedNode: TreeNode | null;
}

interface MaterialCache {
  [meshId: string]: THREE.Material | THREE.Material[];
}

export class SelectionManager {
  private selectedNodeId: string | null = null;
  private selectedNode: TreeNode | null = null;
  private highlightMaterial: THREE.MeshStandardMaterial;
  private materialCache: MaterialCache = {};
  private highlightedMeshes: THREE.Mesh[] = [];

  constructor() {
    this.highlightMaterial = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.3,
      metalness: 0.3,
      roughness: 0.4,
    });
  }

  /**
   * 选择节点并高亮对应的 mesh
   */
  selectNode(node: TreeNode): void {
    // 先清除之前的选择
    if (this.selectedNodeId !== null) {
      this.clearSelection();
    }

    this.selectedNodeId = node.id;
    this.selectedNode = node;

    // 获取该节点下的所有 mesh
    const meshes = getNodeMeshes(node);

    // 缓存原始材质并应用高亮
    for (const mesh of meshes) {
      const meshId = (mesh as any).__nodeId || mesh.uuid;

      // 缓存原始材质
      if (!this.materialCache[meshId]) {
        this.materialCache[meshId] = mesh.material;
      }

      // 应用高亮材质
      mesh.material = this.highlightMaterial;
      this.highlightedMeshes.push(mesh);
    }
  }

  /**
   * 清除选择和高亮
   */
  clearSelection(): void {
    // 恢复原始材质
    for (const mesh of this.highlightedMeshes) {
      const meshId = (mesh as any).__nodeId || mesh.uuid;
      if (this.materialCache[meshId]) {
        mesh.material = this.materialCache[meshId];
      }
    }

    this.highlightedMeshes = [];
    this.selectedNodeId = null;
    this.selectedNode = null;
  }

  /**
   * 获取当前选择状态
   */
  getSelectionState(): SelectionState {
    return {
      selectedNodeId: this.selectedNodeId,
      selectedNode: this.selectedNode,
    };
  }

  /**
   * 获取高亮的 mesh 列表
   */
  getHighlightedMeshes(): THREE.Mesh[] {
    return [...this.highlightedMeshes];
  }

  /**
   * 设置高亮材质颜色
   */
  setHighlightColor(color: number): void {
    this.highlightMaterial.color.setHex(color);
    this.highlightMaterial.emissive.setHex(color);
  }

  /**
   * 设置高亮材质发光强度
   */
  setHighlightEmissiveIntensity(intensity: number): void {
    this.highlightMaterial.emissiveIntensity = intensity;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.highlightMaterial.dispose();
    this.materialCache = {};
    this.highlightedMeshes = [];
    this.selectedNodeId = null;
    this.selectedNode = null;
  }
}
