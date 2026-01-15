/**
 * 量测可视化管理器
 * 负责 marker、线段、距离标签的创建和管理
 */

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export interface MeasurementPoint {
  position: THREE.Vector3;
  marker: THREE.Mesh;
  label?: CSS2DObject;
}

export interface MeasurementVisualization {
  pointA: MeasurementPoint;
  pointB: MeasurementPoint;
  line: THREE.Line;
  distanceLabel: CSS2DObject;
  distance: number;
  unit: string;
}

export class MeasurementVisualizer {
  private scene: THREE.Scene;
  private unitScale: number = 1; // 1 = 米, 0.001 = 毫米
  private measurements: MeasurementVisualization[] = [];
  private previewLine: THREE.Line | null = null;
  private previewLabel: CSS2DObject | null = null;

  constructor(scene: THREE.Scene, unitScale: number = 1) {
    this.scene = scene;
    this.unitScale = unitScale;
  }

  /**
   * 创建 marker（小球）
   */
  private createMarker(position: THREE.Vector3, color: number = 0x00ff00): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(position);
    this.scene.add(marker);
    return marker;
  }

  /**
   * 创建距离标签（CSS2D）
   */
  private createDistanceLabel(position: THREE.Vector3, distance: number, unit: string): CSS2DObject {
    const div = document.createElement('div');
    div.className = 'measurement-label';
    div.style.cssText = `
      background: rgba(0, 0, 0, 0.7);
      color: #00ff00;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      white-space: nowrap;
      pointer-events: none;
      border: 1px solid #00ff00;
    `;
    div.textContent = `${distance.toFixed(2)} ${unit}`;

    const label = new CSS2DObject(div);
    label.position.copy(position);
    this.scene.add(label);
    return label;
  }

  /**
   * 创建连接线
   */
  private createLine(pointA: THREE.Vector3, pointB: THREE.Vector3, color: number = 0xff0000): THREE.Line {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([pointA.x, pointA.y, pointA.z, pointB.x, pointB.y, pointB.z]),
      3
    ));
    const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    return line;
  }

  /**
   * 计算距离和单位
   */
  private calculateDistance(pointA: THREE.Vector3, pointB: THREE.Vector3): { distance: number; unit: string } {
    const rawDistance = pointA.distanceTo(pointB);
    const scaledDistance = rawDistance / this.unitScale;

    let distance = scaledDistance;
    let unit = 'm';

    // 自动选择合适的单位
    if (this.unitScale === 1) {
      if (scaledDistance < 0.001) {
        distance = scaledDistance * 1000000;
        unit = 'μm';
      } else if (scaledDistance < 1) {
        distance = scaledDistance * 1000;
        unit = 'mm';
      } else if (scaledDistance < 1000) {
        distance = scaledDistance;
        unit = 'm';
      } else {
        distance = scaledDistance / 1000;
        unit = 'km';
      }
    } else if (this.unitScale === 0.001) {
      // 如果输入已经是毫米
      if (scaledDistance < 1) {
        distance = scaledDistance * 1000;
        unit = 'μm';
      } else if (scaledDistance < 1000) {
        distance = scaledDistance;
        unit = 'mm';
      } else {
        distance = scaledDistance / 1000;
        unit = 'm';
      }
    }

    return { distance, unit };
  }

  /**
   * 添加第一个点（A）
   */
  addPointA(position: THREE.Vector3): MeasurementPoint {
    const marker = this.createMarker(position, 0x0000ff); // 蓝色
    return {
      position: position.clone(),
      marker,
    };
  }

  /**
   * 添加第二个点（B）并完成测量
   */
  addPointB(pointA: MeasurementPoint, pointB: THREE.Vector3): MeasurementVisualization {
    const markerB = this.createMarker(pointB, 0xff0000); // 红色

    // 计算距离
    const { distance, unit } = this.calculateDistance(pointA.position, pointB);

    // 创建线段
    const line = this.createLine(pointA.position, pointB, 0xffff00);

    // 创建距离标签（放在中点）
    const midpoint = new THREE.Vector3().addVectors(pointA.position, pointB).multiplyScalar(0.5);
    const distanceLabel = this.createDistanceLabel(midpoint, distance, unit);

    const measurement: MeasurementVisualization = {
      pointA,
      pointB: {
        position: pointB.clone(),
        marker: markerB,
      },
      line,
      distanceLabel,
      distance,
      unit,
    };

    this.measurements.push(measurement);
    return measurement;
  }

  /**
   * 显示预览线（鼠标移动时）
   */
  showPreview(pointA: MeasurementPoint, currentPosition: THREE.Vector3): void {
    // 删除旧的预览
    if (this.previewLine) {
      this.scene.remove(this.previewLine);
      this.previewLine = null;
    }
    if (this.previewLabel) {
      this.scene.remove(this.previewLabel);
      this.previewLabel = null;
    }

    // 创建新的预览线
    this.previewLine = this.createLine(pointA.position, currentPosition, 0x00ff00);

    // 创建预览标签
    const { distance, unit } = this.calculateDistance(pointA.position, currentPosition);
    const midpoint = new THREE.Vector3().addVectors(pointA.position, currentPosition).multiplyScalar(0.5);
    this.previewLabel = this.createDistanceLabel(midpoint, distance, unit);
  }

  /**
   * 清除预览
   */
  clearPreview(): void {
    if (this.previewLine) {
      this.scene.remove(this.previewLine);
      this.previewLine = null;
    }
    if (this.previewLabel) {
      this.scene.remove(this.previewLabel);
      this.previewLabel = null;
    }
  }

  /**
   * 删除单条测量
   */
  removeMeasurement(index: number): void {
    if (index >= 0 && index < this.measurements.length) {
      const measurement = this.measurements[index];
      this.scene.remove(measurement.pointA.marker);
      this.scene.remove(measurement.pointB.marker);
      this.scene.remove(measurement.line);
      this.scene.remove(measurement.distanceLabel);
      this.measurements.splice(index, 1);
    }
  }

  /**
   * 清空所有测量
   */
  clearAll(): void {
    this.measurements.forEach((measurement) => {
      this.scene.remove(measurement.pointA.marker);
      this.scene.remove(measurement.pointB.marker);
      this.scene.remove(measurement.line);
      this.scene.remove(measurement.distanceLabel);
    });
    this.measurements = [];
    this.clearPreview();
  }

  /**
   * 获取所有测量
   */
  getMeasurements(): MeasurementVisualization[] {
    return this.measurements;
  }

  /**
   * 设置单位缩放
   */
  setUnitScale(scale: number): void {
    this.unitScale = scale;
  }

  /**
   * 高亮显示某条测量
   */
  highlightMeasurement(index: number): void {
    if (index >= 0 && index < this.measurements.length) {
      const measurement = this.measurements[index];
      // 改变线的颜色为白色
      (measurement.line.material as THREE.LineBasicMaterial).color.setHex(0xffffff);
      (measurement.line.material as THREE.LineBasicMaterial).linewidth = 4;
    }
  }

  /**
   * 取消高亮
   */
  unhighlightMeasurement(index: number): void {
    if (index >= 0 && index < this.measurements.length) {
      const measurement = this.measurements[index];
      // 恢复线的颜色为黄色
      (measurement.line.material as THREE.LineBasicMaterial).color.setHex(0xffff00);
      (measurement.line.material as THREE.LineBasicMaterial).linewidth = 2;
    }
  }
}
