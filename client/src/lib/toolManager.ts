/**
 * 工具管理器 - 管理当前激活的工具状态
 * 支持：普通选择、运维标注、距离量测等模式
 */

export type ToolType = 'SELECT' | 'OPS_ANNOTATE' | 'MEASURE_DISTANCE';

export interface MeasurePoint {
  x: number;
  y: number;
  z: number;
}

export interface ToolState {
  currentTool: ToolType;
  measurePoints: MeasurePoint[];
}

type ToolStateListener = (state: ToolState) => void;

class ToolManager {
  private state: ToolState = {
    currentTool: 'SELECT',
    measurePoints: [],
  };

  private listeners: Set<ToolStateListener> = new Set();

  subscribe(listener: ToolStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = { ...this.state, measurePoints: [...this.state.measurePoints] };
    this.listeners.forEach((fn) => fn(snapshot));
  }

  getState(): ToolState {
    return { ...this.state, measurePoints: [...this.state.measurePoints] };
  }

  setTool(tool: ToolType): void {
    if (tool !== this.state.currentTool) {
      this.state.measurePoints = [];
    }
    this.state.currentTool = tool;
    this.notify();
  }

  getTool(): ToolType {
    return this.state.currentTool;
  }

  addMeasurePoint(point: MeasurePoint): number {
    this.state.measurePoints.push(point);
    this.notify();
    return this.state.measurePoints.length;
  }

  getMeasurePoints(): MeasurePoint[] {
    return [...this.state.measurePoints];
  }

  clearMeasurePoints(): void {
    this.state.measurePoints = [];
    this.notify();
  }
}

let instance: ToolManager | null = null;

export function getToolManager(): ToolManager {
  if (!instance) {
    instance = new ToolManager();
  }
  return instance;
}
