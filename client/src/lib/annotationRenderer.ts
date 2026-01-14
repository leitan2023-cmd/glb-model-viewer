import * as THREE from 'three';
import { EventRecord } from './eventStore';

export interface AnnotationObject {
  id: string;
  type: 'point' | 'line';
  group: THREE.Group;
}

/**
 * 标注可视化管理器
 */
export class AnnotationRenderer {
  private scene: THREE.Scene;
  private annotations: Map<string, AnnotationObject> = new Map();
  private annotationGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.annotationGroup = new THREE.Group();
    this.annotationGroup.name = 'annotations';
    this.scene.add(this.annotationGroup);
  }

  /**
   * 为事件创建标注
   */
  createAnnotation(event: EventRecord): AnnotationObject | null {
    if (event.points.length === 0) {
      return null;
    }

    const group = new THREE.Group();
    group.name = `annotation-${event.id}`;

    if (event.points.length === 1) {
      // 点标注
      this.createPointAnnotation(group, event.points[0], event.title);
    } else if (event.points.length === 2) {
      // 线标注
      this.createLineAnnotation(group, event.points[0], event.points[1], event.title);
    }

    this.annotationGroup.add(group);

    const annotation: AnnotationObject = {
      id: event.id,
      type: event.points.length === 1 ? 'point' : 'line',
      group,
    };

    this.annotations.set(event.id, annotation);
    return annotation;
  }

  /**
   * 创建点标注
   */
  private createPointAnnotation(
    group: THREE.Group,
    point: { x: number; y: number; z: number },
    label: string
  ): void {
    // 创建小球
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0x00AAFF });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(point.x, point.y, point.z);
    group.add(sphere);

    // 创建标签
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#00AAFF';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(label, 10, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(point.x, point.y + 2, point.z);
    sprite.scale.set(4, 1, 1);
    group.add(sprite);
  }

  /**
   * 创建线标注
   */
  private createLineAnnotation(
    group: THREE.Group,
    point1: { x: number; y: number; z: number },
    point2: { x: number; y: number; z: number },
    label: string
  ): void {
    // 创建线
    const points = [
      new THREE.Vector3(point1.x, point1.y, point1.z),
      new THREE.Vector3(point2.x, point2.y, point2.z),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xFF6600, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    group.add(line);

    // 创建端点球
    const sphereGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFF6600 });

    const sphere1 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere1.position.copy(points[0]);
    group.add(sphere1);

    const sphere2 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere2.position.copy(points[1]);
    group.add(sphere2);

    // 计算距离
    const distance = points[0].distanceTo(points[1]);

    // 创建标签（在线段中点）
    const midpoint = new THREE.Vector3().addVectors(points[0], points[1]).multiplyScalar(0.5);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FF6600';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`${label} (${distance.toFixed(2)})`, 10, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(midpoint);
    sprite.position.y += 2;
    sprite.scale.set(4, 1, 1);
    group.add(sprite);
  }

  /**
   * 删除标注
   */
  removeAnnotation(eventId: string): void {
    const annotation = this.annotations.get(eventId);
    if (annotation) {
      this.annotationGroup.remove(annotation.group);
      this.annotations.delete(eventId);
      annotation.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        }
      });
    }
  }

  /**
   * 清空所有标注
   */
  clearAll(): void {
    const eventIds = Array.from(this.annotations.keys());
    for (const eventId of eventIds) {
      this.removeAnnotation(eventId);
    }
  }

  /**
   * 获取标注
   */
  getAnnotation(eventId: string): AnnotationObject | undefined {
    return this.annotations.get(eventId);
  }

  /**
   * 高亮标注
   */
  highlightAnnotation(eventId: string, highlight: boolean): void {
    const annotation = this.annotations.get(eventId);
    if (annotation) {
      annotation.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
          if (highlight) {
            obj.scale.multiplyScalar(1.5);
          } else {
            obj.scale.divideScalar(1.5);
          }
        }
      });
    }
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.clearAll();
    this.scene.remove(this.annotationGroup);
  }
}
