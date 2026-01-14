/**
 * 工具状态机管理器
 * 管理当前激活的工具（选择、运维标注、量测等）
 */

export type ToolType = 'NONE' | 'OPS_ANNOTATE' | 'MEASURE_DISTANCE';

export interface ToolState {
  current: ToolType;
  measurePoints: Array<{ x: number; y: number; z: number }>;
  tempMarker?: any; // THREE.Object3D
}

export class ToolManager {
  private state: ToolState = {
    current: 'NONE',
    measurePoints: [],
  };

  private listeners: Set<(state: ToolState) => void> = new Set();

  /**
   * 设置当前工具
   */
  setTool(tool: ToolType): void {
    if (this.state.current === tool) {
      // 如果重复点击同一工具，则关闭
      this.state.current = 'NONE';
    } else {
      this.state.current = tool;
    }

    // 切换工具时清空测量点
    if (tool !== 'MEASURE_DISTANCE') {
      this.state.measurePoints = [];
    }

    this.notifyListeners();
  }

  /**
   * 获取当前工具
   */
  getTool(): ToolType {
    return this.state.current;
  }

  /**
   * 添加测量点
   */
  addMeasurePoint(point: { x: number; y: number; z: number }): number {
    if (this.state.current !== 'MEASURE_DISTANCE') {
      console.warn('[ToolManager] Not in measure mode');
      return 0;
    }

    this.state.measurePoints.push(point);
    this.notifyListeners();

    return this.state.measurePoints.length;
  }

  /**
   * 获取测量点
   */
  getMeasurePoints(): Array<{ x: number; y: number; z: number }> {
    return [...this.state.measurePoints];
  }

  /**
   * 清空测量点
   */
  clearMeasurePoints(): void {
    this.state.measurePoints = [];
    this.notifyListeners();
  }

  /**
   * 设置临时标记
   */
  setTempMarker(marker: any): void {
    this.state.tempMarker = marker;
    this.notifyListeners();
  }

  /**
   * 获取临时标记
   */
  getTempMarker(): any {
    return this.state.tempMarker;
  }

  /**
   * 清空临时标记
   */
  clearTempMarker(): void {
    this.state.tempMarker = undefined;
    this.notifyListeners();
  }

  /**
   * 获取当前状态
   */
  getState(): ToolState {
    return { ...this.state };
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: (state: ToolState) => void): () => void {
    this.listeners.add(listener);

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const listeners = Array.from(this.listeners);
    for (const listener of listeners) {
      listener(this.getState());
    }
  }

  /**
   * 重置
   */
  reset(): void {
    this.state = {
      current: 'NONE',
      measurePoints: [],
    };
    this.notifyListeners();
  }
}

// 全局单例
let toolManagerInstance: ToolManager | null = null;

export function getToolManager(): ToolManager {
  if (!toolManagerInstance) {
    toolManagerInstance = new ToolManager();
  }
  return toolManagerInstance;
}
