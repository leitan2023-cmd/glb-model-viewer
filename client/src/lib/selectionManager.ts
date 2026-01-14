import * as THREE from 'three';
import { TreeNode, getNodeMeshes } from '@/lib/sceneGraph';

export interface SelectionState {
  selectedNodeIds: Set<string>;
  selectedNodes: Map<string, TreeNode>;
}

interface MaterialState {
  material: THREE.Material | THREE.Material[];
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
  depthTest: boolean;
}

interface MeshMaterialCache {
  [meshId: string]: MaterialState;
}

/**
 * 增强的选择管理器
 * 支持：
 * - 单选/多选
 * - 高亮选中对象
 * - 淡化非选中对象（60% 透明）
 * - 完整的材质缓存和恢复
 */
export class SelectionManager {
  private selectedNodeIds: Set<string> = new Set();
  private selectedNodes: Map<string, TreeNode> = new Map();
  private highlightMaterial: THREE.MeshStandardMaterial;
  private fadedMaterials: Map<THREE.Material, THREE.Material> = new Map();
  private materialCache: MeshMaterialCache = {};
  private highlightedMeshes: THREE.Mesh[] = [];
  private fadedMeshes: THREE.Mesh[] = [];
  private scene: THREE.Group | null = null;

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
   * 设置场景引用（用于获取所有对象）
   */
  setScene(scene: THREE.Group): void {
    this.scene = scene;
  }

  /**
   * 创建淡化材质（基于原材质）
   */
  private createFadedMaterial(originalMaterial: THREE.Material): THREE.Material {
    // 检查缓存
    if (this.fadedMaterials.has(originalMaterial)) {
      return this.fadedMaterials.get(originalMaterial)!;
    }

    let fadedMaterial: THREE.Material;

    if (originalMaterial instanceof THREE.MeshStandardMaterial) {
      fadedMaterial = new THREE.MeshStandardMaterial();
      fadedMaterial.copy(originalMaterial);
    } else if (originalMaterial instanceof THREE.MeshPhongMaterial) {
      fadedMaterial = new THREE.MeshPhongMaterial();
      fadedMaterial.copy(originalMaterial);
    } else if (originalMaterial instanceof THREE.MeshBasicMaterial) {
      fadedMaterial = new THREE.MeshBasicMaterial();
      fadedMaterial.copy(originalMaterial);
    } else {
      // 默认使用 MeshStandardMaterial
      fadedMaterial = new THREE.MeshStandardMaterial();
      fadedMaterial.copy(originalMaterial);
    }

    // 应用淡化效果
    (fadedMaterial as any).transparent = true;
    (fadedMaterial as any).opacity = 0.4;
    (fadedMaterial as any).depthWrite = false;
    (fadedMaterial as any).depthTest = true;

    this.fadedMaterials.set(originalMaterial, fadedMaterial);
    return fadedMaterial;
  }

  /**
   * 选择单个节点（清除之前的选择）
   */
  selectNode(node: TreeNode): void {
    this.clearSelection();
    this.addToSelection(node);
  }

  /**
   * 添加节点到选择集合（支持多选）
   */
  addToSelection(node: TreeNode): void {
    if (this.selectedNodeIds.has(node.id)) {
      return; // 已在选择中
    }

    this.selectedNodeIds.add(node.id);
    this.selectedNodes.set(node.id, node);

    // 获取该节点下的所有 mesh
    const meshes = getNodeMeshes(node);

    // 应用高亮和淡化
    this._applySelectionState(meshes);
  }

  /**
   * 从选择集合中移除节点
   */
  removeFromSelection(nodeId: string): void {
    this.selectedNodeIds.delete(nodeId);
    this.selectedNodes.delete(nodeId);
    this._updateAllMaterials();
  }

  /**
   * 切换节点选择状态（用于 Ctrl/Shift 点击）
   */
  toggleSelection(node: TreeNode): void {
    if (this.selectedNodeIds.has(node.id)) {
      this.removeFromSelection(node.id);
    } else {
      this.addToSelection(node);
    }
  }

  /**
   * 应用选择状态到所有 mesh
   */
  private _applySelectionState(selectedMeshes: THREE.Mesh[]): void {
    if (!this.scene) return;

    // 收集所有 mesh
    const allMeshes: THREE.Mesh[] = [];
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        allMeshes.push(obj);
      }
    });

    // 缓存原始材质（首次）
    for (const mesh of allMeshes) {
      const meshId = (mesh as any).__nodeId || mesh.uuid;
      if (!this.materialCache[meshId]) {
        this.materialCache[meshId] = {
          material: mesh.material,
          transparent: (mesh.material as any).transparent ?? false,
          opacity: (mesh.material as any).opacity ?? 1,
          depthWrite: (mesh.material as any).depthWrite ?? true,
          depthTest: (mesh.material as any).depthTest ?? true,
        };
      }
    }

    // 应用材质
    for (const mesh of allMeshes) {
      const meshId = (mesh as any).__nodeId || mesh.uuid;
      const isSelected = selectedMeshes.includes(mesh);

      if (isSelected) {
        // 高亮选中的 mesh
        mesh.material = this.highlightMaterial;
        if (!this.highlightedMeshes.includes(mesh)) {
          this.highlightedMeshes.push(mesh);
        }
        // 从淡化列表移除
        const fadedIndex = this.fadedMeshes.indexOf(mesh);
        if (fadedIndex > -1) {
          this.fadedMeshes.splice(fadedIndex, 1);
        }
      } else {
        // 淡化非选中的 mesh
        const originalMaterial = this.materialCache[meshId].material;
        const fadedMaterial = this.createFadedMaterial(
          Array.isArray(originalMaterial) ? originalMaterial[0] : originalMaterial
        );
        mesh.material = fadedMaterial;
        if (!this.fadedMeshes.includes(mesh)) {
          this.fadedMeshes.push(mesh);
        }
        // 从高亮列表移除
        const highlightedIndex = this.highlightedMeshes.indexOf(mesh);
        if (highlightedIndex > -1) {
          this.highlightedMeshes.splice(highlightedIndex, 1);
        }
      }
    }
  }

  /**
   * 更新所有 mesh 的材质（当选择变化时调用）
   */
  private _updateAllMaterials(): void {
    if (!this.scene) return;

    // 收集所有选中的 mesh
    const selectedMeshes: THREE.Mesh[] = [];
    this.selectedNodes.forEach((node) => {
      selectedMeshes.push(...getNodeMeshes(node));
    });

    this._applySelectionState(selectedMeshes);
  }

  /**
   * 清除所有选择和淡化效果
   */
  clearSelection(): void {
    if (!this.scene) return;

    // 恢复所有 mesh 到原始材质
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const meshId = (obj as any).__nodeId || obj.uuid;
        if (this.materialCache[meshId]) {
          const cached = this.materialCache[meshId];
          obj.material = cached.material;
          (obj.material as any).transparent = cached.transparent;
          (obj.material as any).opacity = cached.opacity;
          (obj.material as any).depthWrite = cached.depthWrite;
          (obj.material as any).depthTest = cached.depthTest;
        }
      }
    });

    this.selectedNodeIds.clear();
    this.selectedNodes.clear();
    this.highlightedMeshes = [];
    this.fadedMeshes = [];
  }

  /**
   * 获取当前选择状态
   */
  getSelectionState(): SelectionState {
    return {
      selectedNodeIds: new Set(this.selectedNodeIds),
      selectedNodes: new Map(this.selectedNodes),
    };
  }

  /**
   * 检查节点是否被选中
   */
  isNodeSelected(nodeId: string): boolean {
    return this.selectedNodeIds.has(nodeId);
  }

  /**
   * 获取高亮的 mesh 列表
   */
  getHighlightedMeshes(): THREE.Mesh[] {
    return [...this.highlightedMeshes];
  }

  /**
   * 获取淡化的 mesh 列表
   */
  getFadedMeshes(): THREE.Mesh[] {
    return [...this.fadedMeshes];
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
    this.fadedMaterials.forEach((fadedMaterial) => {
      fadedMaterial.dispose();
    });
    this.fadedMaterials.clear();
    this.materialCache = {};
    this.highlightedMeshes = [];
    this.fadedMeshes = [];
    this.selectedNodeIds.clear();
    this.selectedNodes.clear();
  }
}
