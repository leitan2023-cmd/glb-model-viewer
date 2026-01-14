import * as THREE from 'three';
import { TreeNode, findNodeById, findNearestNodeIdInAncestors } from '@/lib/sceneGraph';

export interface PickResult {
  mesh: THREE.Mesh;
  point: THREE.Vector3;
  distance: number;
  node: TreeNode | null;
}

/**
 * 鼠标拾取和结构树定位工具
 * 支持正确的 mesh 映射和向上查找
 */
export class PickingManager {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private scene: THREE.Group | null = null;
  private sceneTree: TreeNode | null = null;
  private pickableObjects: THREE.Object3D[] = [];

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
    
    // 收集所有可拾取的 mesh
    this.collectPickableObjects();
  }

  /**
   * 收集所有可拾取的 mesh 对象
   */
  private collectPickableObjects(): void {
    this.pickableObjects = [];
    
    if (!this.scene) return;

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        this.pickableObjects.push(obj);
      }
    });

    console.log('[PickingManager] Collected pickable objects:', this.pickableObjects.length);
  }

  /**
   * 获取鼠标在归一化设备坐标中的位置
   * 必须使用 canvas 的 boundingClientRect，而不是 window 全屏坐标
   */
  private getMouseNDC(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement
  ): THREE.Vector2 | null {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    console.log('[PickingManager] Canvas rect:', {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      clickX: x,
      clickY: y,
    });

    // 确保坐标在 canvas 范围内
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      console.log('[PickingManager] Click outside canvas bounds');
      return null;
    }

    this.mouse.x = (x / rect.width) * 2 - 1;
    this.mouse.y = -(y / rect.height) * 2 + 1;

    console.log('[PickingManager] NDC coordinates:', {
      x: this.mouse.x,
      y: this.mouse.y,
    });

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
    console.log('[PickingManager] Pick called', {
      hasScene: !!this.scene,
      pickablesCount: this.pickableObjects.length,
      hasSceneTree: !!this.sceneTree,
    });

    if (!this.scene || this.pickableObjects.length === 0) {
      console.log('[PickingManager] Early return: scene or pickables empty');
      return null;
    }

    // 获取鼠标 NDC 坐标
    const mouseNDC = this.getMouseNDC(clientX, clientY, canvas);
    if (!mouseNDC) {
      console.log('[PickingManager] Mouse outside canvas');
      return null;
    }

    // 设置射线
    this.raycaster.setFromCamera(this.mouse, camera);

    // 执行射线交集测试（recursive=true 确保检查所有后代）
    const intersects = this.raycaster.intersectObjects(this.pickableObjects, true);

    console.log('[PickingManager] Raycaster intersects:', intersects.length);

    if (intersects.length === 0) {
      console.log('[PickingManager] No intersections found');
      return null;
    }

    // 获取第一个交集（最近的对象）
    const intersection = intersects[0];
    const mesh = intersection.object as THREE.Mesh;

    console.log('[PickingManager] Hit mesh:', {
      name: mesh.name,
      uuid: mesh.uuid,
      distance: intersection.distance,
    });

    // 向上查找最近的有 nodeId 的父串
    const nodeId = findNearestNodeIdInAncestors(mesh);
    
    console.log('[PickingManager] Found nodeId:', nodeId);

    let node: TreeNode | null = null;
    if (nodeId && this.sceneTree) {
      node = findNodeById(this.sceneTree, nodeId);
      console.log('[PickingManager] Found node:', node?.name);
    }

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
    
    const nodeId = findNearestNodeIdInAncestors(mesh);
    if (!nodeId) return null;
    
    return findNodeById(this.sceneTree, nodeId);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.scene = null;
    this.sceneTree = null;
    this.pickableObjects = [];
  }
}
