import React, { useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { RotateCcw, Maximize2, X, Eye, EyeOff } from 'lucide-react';
import Viewer3D, { Viewer3DInstance } from '@/components/Viewer3D';
import SceneTree from '@/components/SceneTree';
import UploadPanel from '@/components/UploadPanel';
import NodeInfoPanel from '@/components/NodeInfoPanel';
import ModelStats from '@/components/ModelStats';
import AdvancedPanel from '@/components/AdvancedPanel';
import { loadGLB, LoadProgress } from '@/lib/glbLoader';
import { generateSceneTree, TreeNode, getNodePath } from '@/lib/sceneGraph';
import { SelectionManager } from '@/lib/selectionManager';

export default function Home() {
  const [loadedScene, setLoadedScene] = useState<THREE.Group | null>(null);
  const [sceneTree, setSceneTree] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  const viewerRef = useRef<Viewer3DInstance | null>(null);
  const selectionManagerRef = useRef<SelectionManager | null>(null);

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

      toast.success(`成功加载模型: ${file.name}`);
    } catch (error) {
      console.error('加载失败:', error);
      toast.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
      setLoadProgress(0);
    }
  }, []);

  const handleSelectNode = useCallback((nodeId: string) => {
    if (!sceneTree) return;

    // 查找节点
    const findNode = (node: TreeNode): TreeNode | null => {
      if (node.id === nodeId) return node;
      for (const child of node.children) {
        const found = findNode(child);
        if (found) return found;
      }
      return null;
    };

    const node = findNode(sceneTree);
    if (node) {
      setSelectedNodeId(nodeId);
      setSelectedNode(node);

      // 高亮节点
      if (selectionManagerRef.current) {
        selectionManagerRef.current.selectNode(node);
      }

      // 聚焦到该节点
      if (viewerRef.current) {
        viewerRef.current.fitToObject(node.object3D);
      }
    }
  }, [sceneTree]);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeId(null);
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
    if (loadedScene) {
      viewer.fitToModel();
    }
  }, [loadedScene]);

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

            {selectedNodeId && (
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
              <div className="flex-1 overflow-y-auto">
                <SceneTree
                  root={sceneTree}
                  selectedNodeId={selectedNodeId || undefined}
                  onSelectNode={handleSelectNode}
                />
              </div>
              <div className="border-t border-border p-4 space-y-3 bg-background/50 max-h-96 overflow-y-auto">
                <ModelStats scene={loadedScene} />
                {selectedNode && <NodeInfoPanel node={selectedNode} />}
                <AdvancedPanel root={sceneTree} selectedNodeId={selectedNodeId || undefined} />
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
            <Viewer3D scene={loadedScene} onReady={handleViewerReady} />
          )}
        </div>
      </div>
    </div>
  );
}
