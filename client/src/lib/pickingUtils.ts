import * as THREE from 'three';
import { TreeNode, findNodeByObject3D } from '@/lib/sceneGraph';

export interface PickResult {
  mesh: THREE.Mesh;
  point: THREE.Vector3;
  distance: number;
  node: TreeNode | null;
}

/**
 * 鼠标拾取和结构树定位工具
 */
export class PickingManager {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private scene: THREE.Group | null = null;
  private sceneTree: TreeNode | null = null;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  /**
   * 设置场景和场景树
   */
  setScene(scene: THREE.Group, sceneTree: TreeNode | null): void {
    this.scene = scene;
    this.sceneTree = sceneTree;
  }

  /**
   * 获取鼠标在归一化设备坐标中的位置
   */
  private getMouseNDC(
    clientX: number,
    clientY: number,
    container: HTMLElement
  ): THREE.Vector2 {
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    this.mouse.x = (x / rect.width) * 2 - 1;
    this.mouse.y = -(y / rect.height) * 2 + 1;

    return this.mouse;
  }

  /**
   * 执行射线拾取
   */
  pick(
    clientX: number,
    clientY: number,
    camera: THREE.Camera,
    container: HTMLElement
  ): PickResult | null {
    if (!this.scene) return null;

    // 获取鼠标 NDC 坐标
    this.getMouseNDC(clientX, clientY, container);

    // 设置射线
    this.raycaster.setFromCamera(this.mouse, camera);

    // 收集所有可拾取的对象
    const pickableObjects: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        pickableObjects.push(obj);
      }
    });

    // 执行射线交集测试
    const intersects = this.raycaster.intersectObjects(pickableObjects);

    if (intersects.length === 0) {
      return null;
    }

    // 获取第一个交集（最近的对象）
    const intersection = intersects[0];
    const mesh = intersection.object as THREE.Mesh;
    const node = this.sceneTree ? findNodeByObject3D(this.sceneTree, mesh) : null;

    return {
      mesh,
      point: intersection.point,
      distance: intersection.distance,
      node,
    };
  }

  /**
   * 获取 mesh 对应的结构树节点
   */
  getMeshNode(mesh: THREE.Mesh): TreeNode | null {
    if (!this.sceneTree) return null;
    return findNodeByObject3D(this.sceneTree, mesh);
  }

  /**
   * 获取节点的所有祖先节点（从根到该节点的路径）
   */
  getNodePath(node: TreeNode | null): TreeNode[] {
    if (!node) return [];
    const path: TreeNode[] = [node];
    return path;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.scene = null;
    this.sceneTree = null;
  }
}
