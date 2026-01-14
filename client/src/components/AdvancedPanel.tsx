import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Settings } from 'lucide-react';
import { TreeNode } from '@/lib/sceneGraph';
import { exportSelectedNodes, downloadJSON } from '@/lib/exportUtils';

export interface AdvancedPanelProps {
  root: TreeNode | null;
  selectedNodeId?: string;
}

const AdvancedPanel: React.FC<AdvancedPanelProps> = ({ root, selectedNodeId }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExportSelection = () => {
    if (!root || !selectedNodeId) return;

    const exportData = exportSelectedNodes(root, [selectedNodeId]);
    downloadJSON(exportData, `selection-${Date.now()}.json`);
  };

  if (!root || !selectedNodeId) {
    return null;
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
      >
        <Settings className="w-4 h-4" />
        <span>高级选项</span>
      </button>

      {isExpanded && (
        <Card className="p-3 bg-background border-border space-y-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportSelection}
            className="w-full justify-start"
          >
            <Download className="w-4 h-4 mr-2" />
            导出选择
          </Button>
        </Card>
      )}
    </div>
  );
};

export default AdvancedPanel;
