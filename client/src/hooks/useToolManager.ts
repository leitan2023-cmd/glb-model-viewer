/**
 * React Hook: 工具管理器
 */

import { useEffect, useState, useCallback } from 'react';
import { getToolManager, ToolType, ToolState } from '@/lib/toolManager';

export function useToolManager() {
  const toolManager = getToolManager();
  const [toolState, setToolState] = useState<ToolState>(toolManager.getState());

  useEffect(() => {
    // 订阅工具状态变化
    const unsubscribe = toolManager.subscribe((state) => {
      setToolState(state);
    });

    return unsubscribe;
  }, [toolManager]);

  const setTool = useCallback((tool: ToolType) => {
    toolManager.setTool(tool);
  }, [toolManager]);

  const getTool = useCallback(() => {
    return toolManager.getTool();
  }, [toolManager]);

  const addMeasurePoint = useCallback((point: { x: number; y: number; z: number }) => {
    return toolManager.addMeasurePoint(point);
  }, [toolManager]);

  const getMeasurePoints = useCallback(() => {
    return toolManager.getMeasurePoints();
  }, [toolManager]);

  const clearMeasurePoints = useCallback(() => {
    toolManager.clearMeasurePoints();
  }, [toolManager]);

  return {
    toolState,
    setTool,
    getTool,
    addMeasurePoint,
    getMeasurePoints,
    clearMeasurePoints,
  };
}
