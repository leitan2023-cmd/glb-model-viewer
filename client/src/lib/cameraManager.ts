import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { toast } from 'sonner';

export interface CameraFrameOptions {
  duration?: number; // 过渡时间（毫秒）
  padding?: number; // 包围盒周围的填充系数（1.0 = 无填充）
}

interface CameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  near: number;
  far: number;
}

/**
 * 相机管理器 - 带完整的防爆逻辑
 * 提供精准的聚焦、框选和平滑过渡功能
 */
export class CameraManager {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private scene: THREE.Scene | null = null;
  private animationId: number | null = null;
  private startTime: number = 0;
  private prevCameraState: CameraState | null = null;
  private focusToken: number = 0; // 防竞态

  // 距离限制（防爆参数）
  private MIN_DISTANCE = 0.1;
  private MAX_DISTANCE = 100000;
  private MIN_BBOX_SIZE = 1e-6;
  private MAX_BBOX_SIZE = 1e6;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls, scene?: THREE.Scene) {
    this.camera = camera;
    this.controls = controls;
    this.scene = scene || null;
  }

  /**
   * 设置场景引用
   */
  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /**
   * 更新 world matrix（关键！防止 bbox 计算错误）
   */
  private updateWorldMatrix(object: THREE.Object3D): void {
    object.updateWorldMatrix(true, true);
    if (this.scene) {
      this.scene.updateMatrixWorld(true);
    }
  }

  /**
   * 计算对象的世界空间包围盒（带诊断日志）
   */
  private getWorldBoundingBox(object: THREE.Object3D): THREE.Box3 {
    console.log('[focus] selected', { uuid: object.uuid, name: object.name, type: object.type });
    
    this.updateWorldMatrix(object);
    
    const box = new THREE.Box3();
    let meshCount = 0;
    let positionCount = 0;
    
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        meshCount++;
        const posAttr = child.geometry.attributes?.position;
        if (posAttr) positionCount += posAttr.count;
        
        child.geometry.computeBoundingBox();
        const localBox = child.geometry.boundingBox;
        if (localBox) {
          const clonedBox = localBox.clone();
          clonedBox.applyMatrix4(child.matrixWorld);
          box.expandByPoint(clonedBox.min);
          box.expandByPoint(clonedBox.max);
        }
      }
    });
    
    console.log('[focus] geometry', { meshCount, positionCount, hasBbox: !box.isEmpty(), matrixWorldNaN: !isFinite(object.matrixWorld.elements[0]) });
    return box;
  }

  /**
   * 校验包围盒是否有效（带详细日志）
   */
  private isValidBoundingBox(box: THREE.Box3): { valid: boolean; reason?: string } {
    if (box.isEmpty()) {
      console.log('[focus] validation failed: EMPTY_BOX');
      return { valid: false, reason: '该节点无有效几何体' };
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    console.log('[focus] bbox', {
      isEmpty: box.isEmpty(),
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
      size: { x: size.x, y: size.y, z: size.z },
      center: { x: center.x, y: center.y, z: center.z },
      maxDim,
    });

    if (!isFinite(center.x) || !isFinite(center.y) || !isFinite(center.z)) {
      console.log('[focus] validation failed: NAN_CENTER');
      return { valid: false, reason: '包围盒中心点无效' };
    }

    if (!isFinite(size.x) || !isFinite(size.y) || !isFinite(size.z)) {
      console.log('[focus] validation failed: NAN_SIZE');
      return { valid: false, reason: '包围盒尺寸无效' };
    }

    if (maxDim < this.MIN_BBOX_SIZE) {
      console.log('[focus] validation failed: ZERO_SIZE');
      return { valid: false, reason: '对象过小，无法聚焦' };
    }

    if (maxDim > this.MAX_BBOX_SIZE) {
      console.log('[focus] validation failed: HUGE_SIZE');
      return { valid: false, reason: '对象过大，无法聚焦' };
    }

    console.log('[focus] validation passed');
    return { valid: true };
  }

  /**
   * Clamp 函数
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * 根据包围盒计算合适的相机距离（带防爆）
   */
  private calculateCameraDistance(box: THREE.Box3, padding: number = 1.2): number {
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // 基于 FOV 计算距离
    const fov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    let distance = maxDim / (2 * Math.tan(fov));

    // 应用填充系数
    distance *= padding;

    // 计算距离限制
    const minDist = maxDim * 0.8;
    const maxDist = maxDim * 10;

    // 应用上下限
    distance = this.clamp(distance, minDist, maxDist);

    // 最终的全局限制
    distance = this.clamp(distance, this.MIN_DISTANCE, this.MAX_DISTANCE);

    return distance;
  }

  /**
   * 保存当前相机状态（用于失败回滚）
   */
  private saveCameraState(): CameraState {
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      near: this.camera.near,
      far: this.camera.far,
    };
  }

  /**
   * 恢复相机状态（失败回滚）
   */
  private restoreCameraState(state: CameraState): void {
    this.camera.position.copy(state.position);
    this.controls.target.copy(state.target);
    this.camera.near = state.near;
    this.camera.far = state.far;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /**
   * 检查相机是否能看到目标点
   */
  private canSeeTarget(targetCenter: THREE.Vector3, distance: number): boolean {
    // 检查目标点是否在相机前方
    const toTarget = targetCenter.clone().sub(this.camera.position);
    const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    
    const dotProduct = toTarget.dot(cameraDirection);
    
    // 如果点积为负，说明目标在相机后方
    if (dotProduct < 0) {
      return false;
    }

    // 检查距离是否合理
    if (distance <= 0 || !isFinite(distance)) {
      return false;
    }

    return true;
  }

  /**
   * 聚焦到对象（立即）- 带防爆逻辑
   */
  frameObject(object: THREE.Object3D, options: CameraFrameOptions = {}): void {
    this.cancelAnimation();
    const { padding = 1.2 } = options;

    // 保存当前状态以便失败回滚
    const prevState = this.saveCameraState();

    try {
      // 计算包围盒
      const box = this.getWorldBoundingBox(object);

      // 校验包围盒
      const validation = this.isValidBoundingBox(box);
      if (!validation.valid) {
        toast.warning(`无法聚焦: ${validation.reason}`);
        return;
      }

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const distance = this.calculateCameraDistance(box, padding);

      // 获取当前相机方向（沿当前朝向退后）
      const direction = this.camera.position.clone().sub(this.controls.target).normalize();

      // 计算新的相机位置
      const newPos = center.clone().add(direction.multiplyScalar(distance));

      // 检查是否能看到目标
      if (!this.canSeeTarget(center, distance)) {
        console.log('[focus] failed: cannot see target');
        toast.warning('聚焦位置异常，已回滚');
        return;
      }

      console.log('[focus] camera params', { distance, near: this.camera.near, far: this.camera.far });
      console.log('[focus] camera move', {
        prevPos: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
        nextPos: { x: newPos.x, y: newPos.y, z: newPos.z },
        target: { x: center.x, y: center.y, z: center.z },
      });

      // 更新相机位置
      this.camera.position.copy(newPos);
      this.controls.target.copy(center);

      // 自适应 near/far 以避免裁剪
      const maxDim = Math.max(size.x, size.y, size.z);
      this.camera.near = Math.max(distance / 1000, 0.01);
      this.camera.far = Math.max(distance * 100, 2000);
      this.camera.updateProjectionMatrix();

      this.controls.update();
      console.log('[focus] success');
    } catch (error) {
      console.error('[focus] error', error);
      toast.error('聚焦失败，已回滚到上一视角');
      this.restoreCameraState(prevState);
    }
  }

  /**
   * 聚焦到对象（带平滑过渡）- 带防爆逻辑
   */
  frameObjectSmooth(object: THREE.Object3D, options: CameraFrameOptions = {}): void {
    // 防竞态：生成新 token
    const token = ++this.focusToken;
    this.cancelAnimation();
    const { duration = 400, padding = 1.2 } = options;

    // 保存当前状态以便失败回滚
    const prevState = this.saveCameraState();
    this.prevCameraState = prevState;

    try {
      // 计算包围盒
      const box = this.getWorldBoundingBox(object);

      // 校验包围盒
      const validation = this.isValidBoundingBox(box);
      if (!validation.valid) {
        toast.warning(`无法聚焦: ${validation.reason}`);
        return;
      }

      const targetCenter = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const targetDistance = this.calculateCameraDistance(box, padding);

      // 获取当前相机方向
      const direction = this.camera.position.clone().sub(this.controls.target).normalize();

      // 计算目标相机位置
      const targetPosition = targetCenter.clone().add(direction.multiplyScalar(targetDistance));

      // 检查是否能看到目标
      if (!this.canSeeTarget(targetCenter, targetDistance)) {
        toast.warning('聚焦位置异常，已回滚');
        this.restoreCameraState(prevState);
        return;
      }

      // 保存起始状态
      const startPosition = this.camera.position.clone();
      const startTarget = this.controls.target.clone();
      const startNear = this.camera.near;
      const startFar = this.camera.far;

      // 计算目标 near/far
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetNear = Math.max(targetDistance / 1000, 0.01);
      const targetFar = Math.max(targetDistance * 100, 2000);

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

        // 插值 near/far
        this.camera.near = startNear + (targetNear - startNear) * easeProgress;
        this.camera.far = startFar + (targetFar - startFar) * easeProgress;
        this.camera.updateProjectionMatrix();

        this.controls.update();

        if (progress < 1) {
          this.animationId = requestAnimationFrame(animate);
        } else {
          this.animationId = null;
        }
      };

      this.animationId = requestAnimationFrame(animate);
    } catch (error) {
      console.error('平滑聚焦失败:', error);
      toast.error('聚焦失败，已回滚到上一视角');
      this.restoreCameraState(prevState);
    }
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

    // 校验包围盒
    const validation = this.isValidBoundingBox(totalBox);
    if (!validation.valid) {
      toast.warning(`无法聚焦: ${validation.reason}`);
      return;
    }

    // 使用 frameObjectSmooth 处理
    const tempGroup = new THREE.Group();
    tempGroup.position.copy(totalBox.getCenter(new THREE.Vector3()));
    this.frameObjectSmooth(tempGroup, options);
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
