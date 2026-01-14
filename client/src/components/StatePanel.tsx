import React from 'react';
import { Card } from '@/components/ui/card';
import { PartState } from '@/lib/stateStore';

export interface StatePanelProps {
  partName: string;
  state: PartState | null;
}

const StatePanel: React.FC<StatePanelProps> = ({ partName, state }) => {
  if (!state) {
    return (
      <Card className="p-3 bg-muted/30">
        <div className="text-sm text-muted-foreground">
          <div className="font-medium mb-2">{partName}</div>
          <div>暂无状态数据</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 bg-muted/30">
      <div className="text-sm space-y-2">
        <div className="font-medium">{partName}</div>

        {state.stage && (
          <div>
            <span className="text-muted-foreground">施工阶段：</span>
            <span className="font-medium">{state.stage}</span>
          </div>
        )}

        {state.status && (
          <div>
            <span className="text-muted-foreground">状态：</span>
            <span className="font-medium">{state.status}</span>
          </div>
        )}

        <div>
          <span className="text-muted-foreground">更新时间：</span>
          <span className="font-medium">{new Date(state.updatedAt).toLocaleString()}</span>
        </div>

        {state.metrics && Object.keys(state.metrics).length > 0 && (
          <div>
            <div className="text-muted-foreground mb-1">其他指标：</div>
            <div className="ml-2 space-y-1">
              {Object.entries(state.metrics).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-muted-foreground">{key}：</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default StatePanel;
