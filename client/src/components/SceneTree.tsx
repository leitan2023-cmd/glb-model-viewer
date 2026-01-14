import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, Box, Lightbulb, Camera, HelpCircle } from 'lucide-react';
import { TreeNode, searchTreeNodes } from '@/lib/sceneGraph';
import { Input } from '@/components/ui/input';

export interface SceneTreeProps {
  root: TreeNode | null;
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  onExpandNode?: (nodeId: string) => void;
}

interface ExpandedState {
  [nodeId: string]: boolean;
}

const SceneTree: React.FC<SceneTreeProps> = ({
  root,
  selectedNodeId,
  onSelectNode,
  onExpandNode,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<ExpandedState>({});
  const [searchQuery, setSearchQuery] = useState('');

  // 过滤节点
  const filteredNodes = useMemo(() => {
    if (!root || !searchQuery) return null;
    return searchTreeNodes(root, searchQuery);
  }, [root, searchQuery]);

  const handleToggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
    onExpandNode?.(nodeId);
  };

  const handleSelectNode = (nodeId: string) => {
    onSelectNode?.(nodeId);
  };

  const getNodeIcon = (node: TreeNode) => {
    switch (node.type) {
      case 'Mesh':
        return <Box className="w-4 h-4 text-accent" />;
      case 'Light':
        return <Lightbulb className="w-4 h-4 text-yellow-500" />;
      case 'Camera':
        return <Camera className="w-4 h-4 text-blue-500" />;
      case 'Group':
        return <Folder className="w-4 h-4 text-gray-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes[node.id];
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-secondary/50 rounded transition-colors ${
            isSelected ? 'bg-accent/20 border-l-2 border-accent' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleSelectNode(node.id)}
        >
          {hasChildren ? (
            <button
              className="p-0 hover:bg-secondary rounded"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand(node.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {getNodeIcon(node)}

          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground truncate">{node.name}</div>
            {node.meshCount > 0 && (
              <div className="text-xs text-muted-foreground">
                {node.meshCount} mesh{node.meshCount > 1 ? 'es' : ''}
              </div>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!root) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <p>加载模型以查看结构树</p>
      </div>
    );
  }

  const nodesToDisplay = filteredNodes || [root];

  return (
    <div className="w-full h-full flex flex-col bg-card border-r border-border">
      <div className="p-3 border-b border-border">
        <Input
          placeholder="搜索节点..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          {filteredNodes ? (
            filteredNodes.map((node) => renderNode(node, 0))
          ) : (
            renderNode(root)
          )}
        </div>
      </div>
    </div>
  );
};

export default SceneTree;
