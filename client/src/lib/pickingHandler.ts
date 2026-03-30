/**
 * 统一的拾取处理接口
 * 根据当前工具状态分发拾取事件
 */

import * as THREE from 'three';
import { getToolManager, ToolType } from './toolManager';
import { PickResult } from './pickingUtils';

export interface PickingContext {
  // 拾取结果
  hit: PickResult | null;
  
  // 指针事件信息
  screenX: number;
  screenY: number;
  
  // 3D 点信息
  point?: THREE.Vector3;
  normal?: THREE.Vector3;
  
  // 调试信息
  debugInfo?: any;
}

export interface PickingHandlers {
  // 普通选择模式
  onSelect?: (context: PickingContext) => void;
  
  // 运维标注模式
  onOpsAnnotate?: (context: PickingContext) => void;
  
  // 量测模式
  onMeasure?: (context: PickingContext) => void;
  
  // 通用回调
  onPick?: (context: PickingContext) => void;
}

/**
 * 拾取处理器
 */
export class PickingHandler {
  private toolManager = getToolManager();
  private handlers: PickingHandlers = {};

  /**
   * 注册处理器
   */
  registerHandlers(handlers: PickingHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * 处理拾取事件
   */
  handlePick(context: PickingContext): void {
    // 调用通用回调
    this.handlers.onPick?.(context);

    // 根据当前工具分发
    const tool = this.toolManager.getTool();

    switch (tool) {
      case 'SELECT':
        // 普通选择模式
        this.handlers.onSelect?.(context);
        break;

      case 'OPS_ANNOTATE':
        // 运维标注模式
        this.handlers.onOpsAnnotate?.(context);
        break;

      case 'MEASURE_DISTANCE':
        // 量测模式
        this.handlers.onMeasure?.(context);
        break;

      default:
        console.warn(`[PickingHandler] Unknown tool: ${tool}`);
    }
  }

  /**
   * 获取当前工具
   */
  getCurrentTool(): ToolType {
    return this.toolManager.getTool();
  }

  /**
   * 检查是否在特定模式
   */
  isInMode(mode: ToolType): boolean {
    return this.toolManager.getTool() === mode;
  }
}

// 全局单例
let pickingHandlerInstance: PickingHandler | null = null;

export function getPickingHandler(): PickingHandler {
  if (!pickingHandlerInstance) {
    pickingHandlerInstance = new PickingHandler();
  }
  return pickingHandlerInstance;
}

