import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { RotateCcw, Maximize2, X, Eye, EyeOff } from 'lucide-react';
import Viewer3D, { Viewer3DInstance } from '@/components/Viewer3D';
import { PickResult } from '@/lib/pickingUtils';
import SceneTree from '@/components/SceneTree';
import UploadPanel from '@/components/UploadPanel';
import NodeInfoPanel from '@/components/NodeInfoPanel';
import ModelStats from '@/components/ModelStats';
import AdvancedPanel from '@/components/AdvancedPanel';
import { loadGLB, LoadProgress } from '@/lib/glbLoader';
import { generateSceneTree, TreeNode, getNodePath, findNodeById } from '@/lib/sceneGraph';
import { SelectionManager } from '@/lib/selectionManager';

export default function Home() {
  const [loadedScene, setLoadedScene] = useState<THREE.Group | null>(null);
  const [sceneTree, setSceneTree] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  const viewerRef = useRef<Viewer3DInstance | null>(null);
  const selectionManagerRef = useRef<SelectionManager | null>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  const handleFileSelected = useCallback(async (file: File) => {
    setIsLoading(true);
    setLoadProgress(0);

    try {
      const result = await loadGLB(file, (progress: LoadProgress) => {
        setLoadProgress(progress.percentage);
      });

      // 生成场景树
      const tree = generateSceneTree(result.scene);
      setSceneTree(tree);
      setLoadedScene(result.scene);

      // 初始化选择管理器
      if (!selectionManagerRef.current) {
        selectionManagerRef.current = new SelectionManager();
      }
      selectionManagerRef.current.setScene(result.scene);

      // 更新拾取管理器中的场景树
      if (viewerRef.current) {
        viewerRef.current.pickingManager.setScene(result.scene, tree);
      }

      // 清除选择
      setSelectedNodeIds(new Set());
      setSelectedNode(null);
      setExpandedNodeIds(new Set());

      toast.success(`成功加载模型: ${file.name}`);
    } catch (error) {
      console.error('加载失败:', error);
      toast.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
      setLoadProgress(0);
    }
  }, []);

  /**
   * 处理节点选择（来自结构树）
   */
  const handleSelectNode = useCallback((nodeId: string, ctrlKey: boolean = false) => {
    if (!sceneTree || !selectionManagerRef.current) return;

    const node = findNodeById(sceneTree, nodeId);
    if (!node) return;

    let newSelectedIds: Set<string>;

    if (ctrlKey) {
      // Ctrl 点击：切换多选
      newSelectedIds = new Set(selectedNodeIds);
      if (newSelectedIds.has(nodeId)) {
        newSelectedIds.delete(nodeId);
      } else {
        newSelectedIds.add(nodeId);
      }
    } else {
      // 普通点击：单选
      newSelectedIds = new Set([nodeId]);
    }

    setSelectedNodeIds(newSelectedIds);
    setSelectedNode(node);

    // 更新选择管理器
    if (newSelectedIds.size === 0) {
      selectionManagerRef.current.clearSelection();
    } else {
      selectionManagerRef.current.clearSelection();
      newSelectedIds.forEach((id) => {
        const n = findNodeById(sceneTree, id);
        if (n) {
          selectionManagerRef.current!.addToSelection(n);
        }
      });
    }

    // 平滑聚焦到选中节点
    if (viewerRef.current && newSelectedIds.size > 0) {
      viewerRef.current.fitToObjectSmooth(node.object3D, 400);
    }

    // 展开到该节点
    if (sceneTree) {
      const path = getNodePath(sceneTree, nodeId);
      if (path) {
        const newExpandedIds = new Set(expandedNodeIds);
        for (const pathNode of path) {
          newExpandedIds.add(pathNode.id);
        }
        setExpandedNodeIds(newExpandedIds);
      }
    }

    // 滚动到该节点
    setTimeout(() => {
      const element = treeContainerRef.current?.querySelector(
        `[data-node-id="${nodeId}"]`
      );
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 0);
  }, [sceneTree, selectedNodeIds, expandedNodeIds]);

  /**
   * 处理 3D 中的拾取
   */
  const handlePickObject = useCallback((pickResult: PickResult | null) => {
    if (!pickResult || !pickResult.node) {
      handleClearSelection();
      return;
    }

    handleSelectNode(pickResult.node.id, false);
  }, [handleSelectNode]);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setSelectedNode(null);

    if (selectionManagerRef.current) {
      selectionManagerRef.current.clearSelection();
    }
  }, []);

  const handleResetView = useCallback(() => {
    if (viewerRef.current) {
      viewerRef.current.resetView();
    }
  }, []);

  const handleFitModel = useCallback(() => {
    if (viewerRef.current) {
      viewerRef.current.fitToModel();
    }
  }, []);

  const handleViewerReady = useCallback((viewer: Viewer3DInstance) => {
    viewerRef.current = viewer;
    if (sceneTree) {
      viewer.pickingManager.setScene(loadedScene!, sceneTree);
    }
    if (loadedScene) {
      viewer.fitToModel();
    }
  }, [loadedScene, sceneTree]);

  const handleToggleNodeExpanded = useCallback((nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-background">
      {/* 顶部工具条 */}
      <div className="h-16 bg-card border-b border-border flex items-center px-4 gap-3">
        <h1 className="text-lg font-bold text-foreground">GLB Model Viewer</h1>
        <Separator orientation="vertical" className="h-6" />

        {loadedScene && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetView}
              title="重置视角"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              重置视角
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleFitModel}
              title="适配模型"
            >
              <Maximize2 className="w-4 h-4 mr-2" />
              适配模型
            </Button>

            {selectedNodeIds.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearSelection}
                title="清除选择"
              >
                <X className="w-4 h-4 mr-2" />
                清除选择
              </Button>
            )}
          </>
        )}

        <div className="flex-1" />

        {selectedNode && (
          <div className="text-sm text-muted-foreground">
            选中: <span className="text-accent">{selectedNode.name}</span>
            {selectedNode.meshCount > 0 && (
              <span> ({selectedNode.meshCount} mesh)</span>
            )}
            {selectedNodeIds.size > 1 && (
              <span className="ml-2">+ {selectedNodeIds.size - 1} 个</span>
            )}
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：结构树或上传面板 */}
        <div className="w-80 bg-card border-r border-border flex flex-col">
          {!loadedScene ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <UploadPanel
                onFileSelected={handleFileSelected}
                isLoading={isLoading}
                progress={loadProgress}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div
                ref={treeContainerRef}
                className="flex-1 overflow-y-auto"
              >
                <SceneTree
                  root={sceneTree}
                  selectedNodeIds={selectedNodeIds}
                  expandedNodeIds={expandedNodeIds}
                  onSelectNode={handleSelectNode}
                  onToggleExpanded={handleToggleNodeExpanded}
                />
              </div>
              <div className="border-t border-border p-4 space-y-3 bg-background/50 max-h-96 overflow-y-auto">
                <ModelStats scene={loadedScene} />
                {selectedNode && <NodeInfoPanel node={selectedNode} />}
                {sceneTree && (
                  <AdvancedPanel
                    root={sceneTree}
                    selectedNodeIds={selectedNodeIds}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：3D 视窗 */}
        <div className="flex-1 bg-background relative">
          {!loadedScene ? (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-4">上传 GLB 文件开始</p>
                <p className="text-sm">支持拖拽或点击选择文件</p>
              </div>
            </div>
          ) : (
            <Viewer3D
              scene={loadedScene}
              onReady={handleViewerReady}
              onPickObject={handlePickObject}
            />
          )}
        </div>
      </div>
    </div>
  );
}
