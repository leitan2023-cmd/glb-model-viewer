import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';

export interface CameraFrameOptions {
  duration?: number; // 过渡时间（毫秒）
  padding?: number; // 包围盒周围的填充系数（1.0 = 无填充）
}

/**
 * 相机管理器
 * 提供精准的聚焦、框选和平滑过渡功能
 */
export class CameraManager {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private animationId: number | null = null;
  private startTime: number = 0;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera;
    this.controls = controls;
  }

  /**
   * 计算对象的世界空间包围盒
   */
  private getWorldBoundingBox(object: THREE.Object3D): THREE.Box3 {
    const box = new THREE.Box3();
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.geometry.computeBoundingBox();
        const localBox = child.geometry.boundingBox;
        if (localBox) {
          localBox.clone().applyMatrix4(child.matrixWorld);
          box.expandByPoint(localBox.min);
          box.expandByPoint(localBox.max);
        }
      }
    });
    return box;
  }

  /**
   * 根据包围盒计算合适的相机距离
   */
  private calculateCameraDistance(box: THREE.Box3, padding: number = 1.5): number {
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraDistance *= padding;
    return cameraDistance;
  }

  /**
   * 聚焦到对象（立即）
   */
  frameObject(object: THREE.Object3D, options: CameraFrameOptions = {}): void {
    this.cancelAnimation();
    const { padding = 1.5 } = options;

    const box = this.getWorldBoundingBox(object);
    const center = box.getCenter(new THREE.Vector3());
    const distance = this.calculateCameraDistance(box, padding);

    // 获取当前相机方向
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();

    // 设置新的相机位置
    this.camera.position.copy(direction.multiplyScalar(distance).add(center));
    this.controls.target.copy(center);
    this.controls.update();
  }

  /**
   * 聚焦到对象（带平滑过渡）
   */
  frameObjectSmooth(object: THREE.Object3D, options: CameraFrameOptions = {}): void {
    this.cancelAnimation();
    const { duration = 400, padding = 1.5 } = options;

    const box = this.getWorldBoundingBox(object);
    const targetCenter = box.getCenter(new THREE.Vector3());
    const targetDistance = this.calculateCameraDistance(box, padding);

    // 获取当前相机方向
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();

    // 计算目标相机位置
    const targetPosition = direction.clone().multiplyScalar(targetDistance).add(targetCenter);

    // 保存起始状态
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();

    this.startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - this.startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 使用缓动函数（easeInOutCubic）
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // 插值相机位置和目标
      this.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
      this.controls.target.lerpVectors(startTarget, targetCenter, easeProgress);
      this.controls.update();

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * 聚焦到多个对象
   */
  frameObjects(objects: THREE.Object3D[], options: CameraFrameOptions = {}): void {
    if (objects.length === 0) return;

    // 计算所有对象的总包围盒
    let totalBox = new THREE.Box3();
    for (const obj of objects) {
      const box = this.getWorldBoundingBox(obj);
      totalBox.union(box);
    }

    const { padding = 1.5 } = options;
    const center = totalBox.getCenter(new THREE.Vector3());
    const distance = this.calculateCameraDistance(totalBox, padding);
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    const targetPosition = direction.clone().multiplyScalar(distance).add(center);

    // 使用一个临时对象来调用 frameObjectSmooth
    const tempObject = new THREE.Group();
    tempObject.position.copy(center);
    this.frameObjectSmooth(tempObject, options);
  }

  /**
   * 重置视角到默认状态
   */
  resetView(options: CameraFrameOptions = {}): void {
    this.cancelAnimation();
    const { duration = 400 } = options;

    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();

    // 默认视角：从 (10, 10, 10) 看向原点
    const defaultPosition = new THREE.Vector3(10, 10, 10);
    const defaultTarget = new THREE.Vector3(0, 0, 0);

    this.startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - this.startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(startPosition, defaultPosition, easeProgress);
      this.controls.target.lerpVectors(startTarget, defaultTarget, easeProgress);
      this.controls.update();

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * 取消当前动画
   */
  cancelAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.cancelAnimation();
  }
}
