import React from 'react';
import { TreeNode } from '@/lib/sceneGraph';
import { Card } from '@/components/ui/card';
import { calculateBoundingBox, getObjectSize } from '@/lib/glbLoader';
import * as THREE from 'three';

export interface NodeInfoPanelProps {
  node: TreeNode | null;
}

const NodeInfoPanel: React.FC<NodeInfoPanelProps> = ({ node }) => {
  if (!node) {
    return null;
  }

  const bbox = calculateBoundingBox(node.object3D);
  const size = getObjectSize(node.object3D);
  const center = bbox.getCenter(new THREE.Vector3());

  return (
    <Card className="p-4 bg-card border-border">
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-muted-foreground">节点名称</p>
          <p className="text-foreground font-mono text-accent">{node.name}</p>
        </div>

        <div>
          <p className="text-muted-foreground">节点类型</p>
          <p className="text-foreground font-mono">{node.type}</p>
        </div>

        {node.meshCount > 0 && (
          <div>
            <p className="text-muted-foreground">Mesh 数量</p>
            <p className="text-foreground font-mono">{node.meshCount}</p>
          </div>
        )}

        {node.triangleCount > 0 && (
          <div>
            <p className="text-muted-foreground">三角面数</p>
            <p className="text-foreground font-mono">
              {Math.round(node.triangleCount).toLocaleString()}
            </p>
          </div>
        )}

        <div>
          <p className="text-muted-foreground">包围盒尺寸</p>
          <p className="text-foreground font-mono">
            X: {size.x.toFixed(2)} Y: {size.y.toFixed(2)} Z: {size.z.toFixed(2)}
          </p>
        </div>

        <div>
          <p className="text-muted-foreground">中心位置</p>
          <p className="text-foreground font-mono">
            X: {center.x.toFixed(2)} Y: {center.y.toFixed(2)} Z: {center.z.toFixed(2)}
          </p>
        </div>

        {node.children.length > 0 && (
          <div>
            <p className="text-muted-foreground">子节点数</p>
            <p className="text-foreground font-mono">{node.children.length}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default NodeInfoPanel;
