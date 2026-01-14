import * as THREE from 'three';

export interface MeasurePoint {
  position: THREE.Vector3;
  screenX: number;
  screenY: number;
}

export interface MeasureResult {
  point1: MeasurePoint;
  point2: MeasurePoint;
  distance: number;
}

/**
 * 量测工具
 */
export class MeasureTool {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private measureGroup: THREE.Group;
  private points: MeasurePoint[] = [];
  private onMeasureComplete?: (result: MeasureResult) => void;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.measureGroup = new THREE.Group();
    this.measureGroup.name = 'measure-tool';
    this.scene.add(this.measureGroup);
  }

  /**
   * 添加测量点
   */
  addPoint(position: THREE.Vector3, screenX: number, screenY: number): void {
    const point: MeasurePoint = {
      position: position.clone(),
      screenX,
      screenY,
    };

    this.points.push(point);

    // 创建点标记
    this.createPointMarker(position);

    if (this.points.length === 2) {
      // 完成测量
      this.completeMeasure();
    }
  }

  /**
   * 创建点标记
   */
  private createPointMarker(position: THREE.Vector3): void {
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    this.measureGroup.add(sphere);
  }

  /**
   * 完成测量
   */
  private completeMeasure(): void {
    if (this.points.length !== 2) {
      return;
    }

    const p1 = this.points[0];
    const p2 = this.points[1];
    const distance = p1.position.distanceTo(p2.position);

    // 创建连接线
    this.createMeasureLine(p1.position, p2.position, distance);

    const result: MeasureResult = {
      point1: p1,
      point2: p2,
      distance,
    };

    this.onMeasureComplete?.(result);
  }

  /**
   * 创建测量线
   */
  private createMeasureLine(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    distance: number
  ): void {
    // 创建线
    const points = [p1.clone(), p2.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xFF0000, linewidth: 3 });
    const line = new THREE.Line(geometry, material);
    this.measureGroup.add(line);

    // 创建标签
    const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`${distance.toFixed(2)}m`, 10, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(midpoint);
    sprite.position.y += 1;
    sprite.scale.set(4, 1, 1);
    this.measureGroup.add(sprite);
  }

  /**
   * 清除测量
   */
  clear(): void {
    this.points = [];
    this.measureGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    });
    this.measureGroup.clear();
  }

  /**
   * 设置测量完成回调
   */
  setOnMeasureComplete(callback: (result: MeasureResult) => void): void {
    this.onMeasureComplete = callback;
  }

  /**
   * 获取当前点数
   */
  getPointCount(): number {
    return this.points.length;
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.clear();
    this.scene.remove(this.measureGroup);
  }
}

/**
 * 创建 Canvas 纹理标签
 */
export function createTextLabel(text: string, color: string = '#FFFFFF'): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = color;
  ctx.font = 'bold 24px Arial';
  ctx.fillText(text, 10, 40);

  return new THREE.CanvasTexture(canvas);
}
