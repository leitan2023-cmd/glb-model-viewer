import * as THREE from 'three';
import { generateStableKeyMap, getStableKey, findMeshByStableKey, generateModelId } from './stableKeyManager';
import { getModelState, updatePartState, importModelState as importState } from './stateStore';
import { EventRecord, createEventRecord, getEventsByModelId, updateEventRecord, deleteEventRecord } from './eventStore';
import { AnnotationRenderer } from './annotationRenderer';
import { MeasureTool } from './measureTool';

/**
 * MVP 管理器 - 统一处理所有 MVP 相关的逻辑
 */
export class MVPManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private currentModelId: string | null = null;
  private stableKeyMap: Map<THREE.Object3D, any> | null = null;
  private annotationRenderer: AnnotationRenderer | null = null;
  private measureTool: MeasureTool | null = null;
  private currentEvents: EventRecord[] = [];

  // 回调函数
  private onStateChanged?: (state: any) => void;
  private onEventsChanged?: (events: EventRecord[]) => void;
  private onMeasureComplete?: (distance: number, p1: THREE.Vector3, p2: THREE.Vector3) => void;

  constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
  }

  /**
   * 初始化新模型
   */
  async initializeModel(modelFile: File, root: THREE.Object3D): Promise<void> {
    this.currentModelId = generateModelId(modelFile);

    // 生成 stableKey 映射表
    this.stableKeyMap = generateStableKeyMap(root);

    // 应用状态着色
    const state = await getModelState(this.currentModelId);
    if (state) {
      this.applyStateColoring(root, state);
      this.onStateChanged?.(state);
    }

    // 加载事件列表
    this.currentEvents = await getEventsByModelId(this.currentModelId);
    this.onEventsChanged?.(this.currentEvents);

    // 初始化标注渲染器
    if (!this.annotationRenderer) {
      this.annotationRenderer = new AnnotationRenderer(this.scene);
    }

    // 渲染所有标注
    for (const event of this.currentEvents) {
      this.annotationRenderer.createAnnotation(event);
    }

    // 初始化量测工具
    if (!this.measureTool) {
      this.measureTool = new MeasureTool(this.scene, this.camera, this.renderer);
      this.measureTool.setOnMeasureComplete((result) => {
        this.onMeasureComplete?.(result.distance, result.point1.position, result.point2.position);
      });
    }
  }

  /**
   * 应用状态着色
   */
  private applyStateColoring(root: THREE.Object3D, state: any): void {
    const stageColorMap: Record<string, string> = {
      'planning': '#808080',
      'in_progress': '#FFA500',
      'completed': '#00AA00',
      'delayed': '#FF0000',
    };

    const statusColorMap: Record<string, string> = {
      'pending': '#CCCCCC',
      'in_progress': '#FFA500',
      'completed': '#00AA00',
      'failed': '#FF0000',
    };

    root.traverse((obj: any) => {
      if (obj.isMesh) {
        const stableKey = getStableKey(obj);
        if (stableKey && state.parts[stableKey]) {
          const partState = state.parts[stableKey];
          let color = '#FFFFFF';

          if (partState.stage && stageColorMap[partState.stage]) {
            color = stageColorMap[partState.stage];
          } else if (partState.status && statusColorMap[partState.status]) {
            color = statusColorMap[partState.status];
          }

          // 应用颜色
          const material = obj.material as any;
          if (material) {
            if (Array.isArray(material)) {
              material.forEach((m) => {
                m.color.setStyle(color);
              });
            } else {
              material.color.setStyle(color);
            }
          }
        }
      }
    });
  }

  /**
   * 获取 stableKey
   */
  getStableKey(mesh: THREE.Object3D): string | null {
    return getStableKey(mesh);
  }

  /**
   * 从 stableKey 查找 mesh
   */
  findMeshByStableKey(stableKey: string): THREE.Object3D | null {
    if (!this.stableKeyMap) {
      return null;
    }
    return findMeshByStableKey(this.scene, stableKey);
  }

  /**
   * 创建事件
   */
  async createEvent(data: Omit<EventRecord, 'id' | 'createdAt' | 'updatedAt' | 'modelId'>): Promise<EventRecord> {
    if (!this.currentModelId) {
      throw new Error('No model loaded');
    }

    const event = await createEventRecord(this.currentModelId, data);
    this.currentEvents.push(event);
    this.onEventsChanged?.(this.currentEvents);

    // 创建标注
    if (this.annotationRenderer) {
      this.annotationRenderer.createAnnotation(event);
    }

    return event;
  }

  /**
   * 更新事件
   */
  async updateEvent(id: string, data: Partial<EventRecord>): Promise<EventRecord> {
    const updated = await updateEventRecord(id, data);
    const idx = this.currentEvents.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this.currentEvents[idx] = updated;
      this.onEventsChanged?.(this.currentEvents);
    }

    // 更新标注
    if (this.annotationRenderer) {
      this.annotationRenderer.removeAnnotation(id);
      this.annotationRenderer.createAnnotation(updated);
    }

    return updated;
  }

  /**
   * 删除事件
   */
  async deleteEvent(id: string): Promise<void> {
    await deleteEventRecord(id);
    this.currentEvents = this.currentEvents.filter((e) => e.id !== id);
    this.onEventsChanged?.(this.currentEvents);

    // 删除标注
    if (this.annotationRenderer) {
      this.annotationRenderer.removeAnnotation(id);
    }
  }

  /**
   * 获取事件列表
   */
  getEvents(): EventRecord[] {
    return this.currentEvents;
  }

  /**
   * 获取事件
   */
  getEvent(id: string): EventRecord | undefined {
    return this.currentEvents.find((e) => e.id === id);
  }

  /**
   * 添加测量点
   */
  addMeasurePoint(position: THREE.Vector3, screenX: number, screenY: number): void {
    if (this.measureTool) {
      this.measureTool.addPoint(position, screenX, screenY);
    }
  }

  /**
   * 清除测量
   */
  clearMeasure(): void {
    if (this.measureTool) {
      this.measureTool.clear();
    }
  }

  /**
   * 获取测量点数
   */
  getMeasurePointCount(): number {
    if (this.measureTool) {
      return this.measureTool.getPointCount();
    }
    return 0;
  }

  /**
   * 导入状态数据
   */
  async importModelState(json: any): Promise<void> {
    if (!this.currentModelId) {
      throw new Error('No model loaded');
    }

    await importState(this.currentModelId, json);
    const state = await getModelState(this.currentModelId);
    if (state) {
      this.applyStateColoring(this.scene, state);
      this.onStateChanged?.(state);
    }
  }

  /**
   * 设置回调
   */
  setOnStateChanged(callback: (state: any) => void): void {
    this.onStateChanged = callback;
  }

  setOnEventsChanged(callback: (events: EventRecord[]) => void): void {
    this.onEventsChanged = callback;
  }

  setOnMeasureComplete(callback: (distance: number, p1: THREE.Vector3, p2: THREE.Vector3) => void): void {
    this.onMeasureComplete = callback;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.annotationRenderer) {
      this.annotationRenderer.dispose();
    }
    if (this.measureTool) {
      this.measureTool.dispose();
    }
    this.currentEvents = [];
    this.stableKeyMap = null;
  }
}
