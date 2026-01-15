import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { RotateCcw, Maximize2, X, Eye, EyeOff, Upload } from 'lucide-react';
import Viewer3D, { Viewer3DInstance } from '@/components/Viewer3D';
import { PickResult } from '@/lib/pickingUtils';
import SceneTree from '@/components/SceneTree';
import UploadPanel from '@/components/UploadPanel';
import NodeInfoPanel from '@/components/NodeInfoPanel';
import ModelStats from '@/components/ModelStats';
import AdvancedPanel from '@/components/AdvancedPanel';
import PickDebugHUD, { PickDebugState } from '@/components/PickDebugHUD';
import ModelHistory from '@/components/ModelHistory';
import { loadGLB, LoadProgress } from '@/lib/glbLoader';
import { generateSceneTree, TreeNode, findNodeById, getNodePath } from '@/lib/sceneGraph';
import { SelectionManager } from '@/lib/selectionManager';
import { disposeOldModel, calculateModelStats, ModelStats as ModelStatsType } from '@/lib/modelManager';
import { saveModelToHistory } from '@/lib/historyManager';
import EventEditor from '@/components/EventEditor';
import EventList from '@/components/EventList';
import StatePanel from '@/components/StatePanel';
import { generateStableKeyMap, getStableKey, findMeshByStableKey, generateModelId } from '@/lib/stableKeyManager';
import { getModelState, updatePartState, importModelState } from '@/lib/stateStore';
import { EventRecord, createEventRecord, getEventsByModelId, updateEventRecord } from '@/lib/eventStore';
import { AnnotationRenderer } from '@/lib/annotationRenderer';
import { MeasureTool } from '@/lib/measureTool';
import { MVPManager } from '@/lib/mvpManager';
import { useToolManager } from '@/hooks/useToolManager';
import { resolveBusinessNode } from '@/lib/businessNodeResolver';

export default function Home() {
  const [loadedScene, setLoadedScene] = useState<THREE.Group | null>(null);
  const [sceneTree, setSceneTree] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [pickDebugState, setPickDebugState] = useState<PickDebugState>({
    pickablesCount: 0,
    lastDownX: 0,
    lastDownY: 0,
    lastNDCX: 0,
    lastNDCY: 0,
    hitsCount: 0,
    hitName: '',
    hitUUID: '',
    mappedTreeId: '',
  });
  const [modelStats, setModelStats] = useState<ModelStatsType | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [mainModelId, setMainModelId] = useState<string | null>(null);
  const [currentModelState, setCurrentModelState] = useState<any>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const { toolState, setTool, getTool, addMeasurePoint, getMeasurePoints, clearMeasurePoints } = useToolManager();
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const [eventEditorData, setEventEditorData] = useState<any>(null);
  const [stableKeyMap, setStableKeyMap] = useState<Map<THREE.Object3D, any> | null>(null);
  const [showEventTab, setShowEventTab] = useState(false);
  const [showStatePanel, setShowStatePanel] = useState(false);


  const viewerRef = useRef<Viewer3DInstance | null>(null);
  const selectionManagerRef = useRef<SelectionManager | null>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const sceneTreeRef = useRef<TreeNode | null>(null);
  const loadedSceneRef = useRef<THREE.Group | null>(null);
  const annotationRendererRef = useRef<any>(null);
  const measureToolRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mvpManagerRef = useRef<MVPManager | null>(null);


  /**
   * 内部：加载模型的核心逻辑
   */
  const loadModelInternal = useCallback(async (file: File) => {
    try {
      const result = await loadGLB(file, (progress: LoadProgress) => {
        setLoadProgress(progress.percentage);
      });

      // 生成场景树
      const tree = generateSceneTree(result.scene);
      setSceneTree(tree);
      sceneTreeRef.current = tree;
      setLoadedScene(result.scene);
      loadedSceneRef.current = result.scene;

      // 初始化选择管理器
      if (!selectionManagerRef.current) {
        selectionManagerRef.current = new SelectionManager();
      }
      selectionManagerRef.current.setScene(result.scene);

      // 更新拾取管理器中的场景树
      if (viewerRef.current) {
        viewerRef.current.pickingManager.setScene(result.scene, tree);
        // 重新聚焦到模型
        viewerRef.current.fitToModel();
      }

      // 计算模型统计信息
      const stats = calculateModelStats(result.scene, file.size, file.name);
      setModelStats(stats);

      // 清除选择
      setSelectedNodeIds(new Set());
      setSelectedNode(null);
      setExpandedNodeIds(new Set());

      return stats;
    } catch (error) {
      console.error('加载失败:', error);
      throw error;
    }
  }, [getTool, addMeasurePoint, getMeasurePoints, clearMeasurePoints]);

  /**
   * 处理文件选择（初次加载或替换）
   */
  const handleFileSelected = useCallback(async (file: File) => {
    setIsLoading(true);
    setLoadProgress(0);

    try {
      // 清理旧模型
      if (loadedSceneRef.current) {
        disposeOldModel(loadedSceneRef.current);
      }

      // 加载新模型
      const stats = await loadModelInternal(file);

      // 生成缩略图并保存到历史记录
      try {
        let thumbDataUrl = '';
        if (viewerRef.current) {
          thumbDataUrl = await viewerRef.current.generateThumbnail(256, 256);
        }
        await saveModelToHistory(file, stats, thumbDataUrl);
      } catch (historyError) {
        console.warn('Failed to save to history:', historyError);
      }

      toast.success(`成功加载模型: ${file.name}`);

      // 初始化 MVP Manager
      if (viewerRef.current && loadedSceneRef.current) {
        if (!mvpManagerRef.current) {
          mvpManagerRef.current = new MVPManager(
            viewerRef.current.scene,
            viewerRef.current.camera,
            viewerRef.current.renderer
          );
        }
        await mvpManagerRef.current.initializeModel(file, loadedSceneRef.current);
        setMainModelId(mvpManagerRef.current['currentModelId']);
      }
    } catch (error) {
      console.error('加载失败:', error);
      toast.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
      setLoadProgress(0);
    }
  }, [loadModelInternal]);

  /**
   * 处理节点选择（来自结构树）
   */
  const handleSelectNode = useCallback((nodeId: string, ctrlKey: boolean = false) => {
    const tree = sceneTreeRef.current;
    if (!tree || !selectionManagerRef.current || !viewerRef.current) return;

    const node = findNodeById(tree, nodeId);
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

    // 获取所有选中的节点
    const selectedNodes = Array.from(newSelectedIds)
      .map((id) => findNodeById(tree, id))
      .filter((n) => n !== null) as TreeNode[];

    // 更新选择管理器
    selectionManagerRef.current.clearSelection();
    for (const selectedNode of selectedNodes) {
      selectionManagerRef.current.addToSelection(selectedNode);
    }

    // 更新 UI
    setSelectedNode(selectedNodes[0] || null);

    // 展开到该节点
    if (selectedNodes.length > 0) {
      const path = getNodePath(tree, selectedNodes[0].id); // 来自 sceneGraph
      if (path) {
        const newExpandedIds = new Set(expandedNodeIds);
        for (const pathNode of path) {
          newExpandedIds.add(pathNode.id);
        }
        setExpandedNodeIds(newExpandedIds);
      }
    }

    // 平滑聚焦到选中节点（仅当单选时）
    if (newSelectedIds.size === 1) {
      viewerRef.current.fitToObjectSmooth(node.object3D, 400);
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
  }, [selectedNodeIds, expandedNodeIds]);

  /**
   * 处理 3D 中的拾取
   */
  const handlePickObject = useCallback((pickResult: PickResult | null, debugInfo?: any) => {
    // 运维模式：创建事件
    const tool = getTool();

    // 运维模式：创建事件
    if (tool === 'OPS_ANNOTATE' && pickResult) {
      const stableKey = mvpManagerRef.current?.getStableKey(pickResult.mesh);
      if (stableKey) {
        setEventEditorData({
          type: 'bearing',
          title: '',
          targetKey: stableKey,
          targetName: pickResult.node?.name || pickResult.mesh.name,
          points: [pickResult.point],
          fields: {},
          attachments: [],
        });
        setEventEditorOpen(true);
      }
      return;
    }

    // 量测模式：添加测量点
    // 量测模式：添加测量点
    if (tool === 'MEASURE_DISTANCE' && pickResult) {
      const pointCount = addMeasurePoint({
        x: pickResult.point.x,
        y: pickResult.point.y,
        z: pickResult.point.z,
      });
      
      if (pointCount === 2) {
        // 计算距离
        const points = getMeasurePoints();
        if (points.length === 2) {
          const p1 = new THREE.Vector3(points[0].x, points[0].y, points[0].z);
          const p2 = new THREE.Vector3(points[1].x, points[1].y, points[1].z);
          const distance = p1.distanceTo(p2);
          toast.success(`测量完成：${distance.toFixed(2)}m`);
          // 清除测量点，准备下一次测量
          clearMeasurePoints();
        }
      }
      return;
    }

    // 普通模式：选择构件
    console.log('[Home] handlePickObject called with result:', pickResult);
    
    if (!pickResult) {
      console.log('[Home] pickResult is null');
      handleClearSelection();
      return;
    }

    // 业务节点提升：跳过 Mesh_/Node_/Scene，找到业务命名节点
    const hitMesh = pickResult.mesh;
    const selectedBusinessNode = resolveBusinessNode(hitMesh);
    const hitMeshName = hitMesh.name;
    const selectedNodeName = selectedBusinessNode.name;
    
    console.log('[Home] hitMesh:', hitMeshName, 'selectedNode:', selectedNodeName);
    // 业务节点路径已在 resolveBusinessNode 中输出

    // 在树中查找对应的业务节点
    if (!sceneTreeRef.current) {
      console.log('[Home] sceneTree is null');
      handleClearSelection();
      return;
    }

    const treeNode = findNodeById(sceneTreeRef.current, selectedBusinessNode.uuid);
    if (!treeNode) {
      console.log('[Home] tree node not found for uuid:', selectedBusinessNode.uuid);
      handleClearSelection();
      return;
    }

    // 更新 Debug HUD
    const updatedDebugInfo = {
      ...debugInfo,
      hitMeshName,
      selectedNodeName,
    };
    setPickDebugState(updatedDebugInfo);

    console.log('[Home] Selecting tree node:', treeNode.id, treeNode.name);
    handleSelectNode(treeNode.id, false);
  }, [getTool, addMeasurePoint, getMeasurePoints, clearMeasurePoints]);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setSelectedNode(null);

    if (selectionManagerRef.current) {
      selectionManagerRef.current.clearSelection();
    }
  }, [getTool, addMeasurePoint, getMeasurePoints, clearMeasurePoints]);

  const handleResetView = useCallback(() => {
    if (viewerRef.current) {
      viewerRef.current.resetView();
    }
  }, [getTool, addMeasurePoint, getMeasurePoints, clearMeasurePoints]);

  const handleFitModel = useCallback(() => {
    if (viewerRef.current) {
      viewerRef.current.fitToModel();
    }
  }, [getTool, addMeasurePoint, getMeasurePoints, clearMeasurePoints]);

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
  }, [getTool, addMeasurePoint, getMeasurePoints, clearMeasurePoints]);

  const handleViewerReady = useCallback((viewer: Viewer3DInstance) => {
    viewerRef.current = viewer;
    
    // 仅在首次加载时调用 fitToModel
    if (loadedSceneRef.current && sceneTreeRef.current) {
      viewer.pickingManager.setScene(loadedSceneRef.current, sceneTreeRef.current);
      viewer.fitToModel();
    }
  }, [getTool, addMeasurePoint, getMeasurePoints, clearMeasurePoints]);

  const handleUploadClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileSelected(file);
      }
    };
    input.click();
  }, [handleFileSelected]);

  return (
    <div className="w-screen h-screen flex flex-col bg-background">
      {/* Debug HUD */}
      <PickDebugHUD state={pickDebugState} />

      {/* 顶部工具条 */}
      <div className="h-16 bg-card border-b border-border flex items-center px-4 gap-3">
        <h1 className="text-lg font-bold text-foreground">GLB Model Viewer</h1>
        <Separator orientation="vertical" className="h-6" />

        <Button
          size="sm"
          variant="outline"
          onClick={handleUploadClick}
          disabled={isLoading}
          title="上传新模型"
        >
          <Upload className="w-4 h-4 mr-2" />
          上传模型
        </Button>

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

            {loadedScene && (
              <>
                <Button
                  size="sm"
                  variant={maintenanceMode ? 'default' : 'outline'}
                  onClick={() => setTool("OPS_ANNOTATE")}
                  title="运维模式：点击模型创建事件"
                >
                  🔧 运维模式
                </Button>
                <Button
                  size="sm"
                  variant={measureMode ? 'default' : 'outline'}
                  onClick={() => setTool("MEASURE_DISTANCE")}
                  title="量测模式：点击两处测量距离"
                >
                  📏 量测
                </Button>
              </>
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
              {/* 标签页：结构树 / 历史模型 / 事件记录 */}
              <div className="flex border-b border-border bg-background/50">
                <button
                  onClick={() => { setShowHistory(false); setShowEventTab(false); }}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    !showHistory && !showEventTab
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  结构树
                </button>
                <button
                  onClick={() => { setShowHistory(true); setShowEventTab(false); }}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    showHistory && !showEventTab
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  历史模型
                </button>
                <button
                  onClick={() => { setShowHistory(false); setShowEventTab(true); }}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    showEventTab
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  事件记录
                </button>
              </div>

              {/* 内容区域 */}
              {!showHistory && !showEventTab ? (
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
              ) : showHistory ? (
                <div className="flex-1 overflow-hidden">
                  <ModelHistory
                    onLoadModel={handleFileSelected}
                    isLoading={isLoading}
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-hidden">
                  {events.length > 0 ? (
                    <EventList
                      events={events}
                      selectedEventId={selectedEventId || undefined}
                      onSelectEvent={(event) => {
                        setSelectedEventId(event.id);
                        if (mvpManagerRef.current) {
                          const mesh = mvpManagerRef.current.findMeshByStableKey(event.targetKey);
                          if (mesh && viewerRef.current) {
                            viewerRef.current.fitToObjectSmooth(mesh);
                          }
                        }
                      }}
                      onEditEvent={(event) => {
                        setEventEditorData(event);
                        setEventEditorOpen(true);
                      }}
                      onDeleteEvent={() => {
                        setSelectedEventId(null);
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <p>暂无事件记录</p>
                        <p className="text-sm mt-2">启用运维模式后可创建事件</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
        <div className="flex-1 bg-background relative pointer-events-auto">
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
              sceneTree={sceneTree}
              onReady={handleViewerReady}
              onPickObject={handlePickObject}
            />
          )}
        </div>
      </div>

      {/* 事件编辑弹窗 */}
      {eventEditorOpen && (
        <EventEditor
          open={eventEditorOpen}
          event={eventEditorData}
          targetKey={eventEditorData?.targetKey || ''}
          targetName={eventEditorData?.targetName || ''}
          points={eventEditorData?.points || []}
          onSave={async (data) => {
            try {
              if (eventEditorData?.id) {
                await mvpManagerRef.current?.updateEvent(eventEditorData.id, data as any);
              } else {
                await mvpManagerRef.current?.createEvent(data);
              }
              setEvents(mvpManagerRef.current?.getEvents() || []);
              setEventEditorOpen(false);
              setEventEditorData(null);
              toast.success('事件已保存');
            } catch (error) {
              toast.error('保存失败');
            }
          }}
          onCancel={() => {
            setEventEditorOpen(false);
            setEventEditorData(null);
          }}
        />
      )}
    </div>
  );
}
