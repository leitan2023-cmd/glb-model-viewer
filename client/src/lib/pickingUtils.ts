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
   * 必须使用 canvas 的 boundingClientRect，而不是 window 全屏坐标
   */
  private getMouseNDC(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement
  ): THREE.Vector2 {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // 确保坐标在 canvas 范围内
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      return null as any;
    }

    this.mouse.x = (x / rect.width) * 2 - 1;
    this.mouse.y = -(y / rect.height) * 2 + 1;

    return this.mouse;
  }

  /**
   * 执行射线拾取
   * @param clientX 鼠标客户端 X 坐标
   * @param clientY 鼠标客户端 Y 坐标
   * @param camera 相机对象
   * @param canvas 渲染器的 canvas 元素
   */
  pick(
    clientX: number,
    clientY: number,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement
  ): PickResult | null {
    if (!this.scene) return null;

    // 获取鼠标 NDC 坐标
    const mouseNDC = this.getMouseNDC(clientX, clientY, canvas);
    if (!mouseNDC) return null;

    // 设置射线
    this.raycaster.setFromCamera(this.mouse, camera);

    // 收集所有可拾取的对象（所有 Mesh）
    const pickableObjects: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        pickableObjects.push(obj);
      }
    });

    if (pickableObjects.length === 0) {
      return null;
    }

    // 执行射线交集测试（recursive=true 确保检查所有后代）
    const intersects = this.raycaster.intersectObjects(pickableObjects, true);

    if (intersects.length === 0) {
      return null;
    }

    // 获取第一个交集（最近的对象）
    const intersection = intersects[0];
    const mesh = intersection.object as THREE.Mesh;
    const node = this.sceneTree ? findNodeByObject3D(this.sceneTree, mesh) : null;

    return {
      mesh,
      point: intersection.point.clone(),
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
   * 清理资源
   */
  dispose(): void {
    this.scene = null;
    this.sceneTree = null;
  }
}
