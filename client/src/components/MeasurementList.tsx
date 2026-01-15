/**
 * 测量列表面板
 * 显示所有测量记录，支持删除、清空、回显
 */

import { Trash2, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Measurement {
  id: string;
  distance: number;
  unit: string;
  createdAt: string;
}

interface MeasurementListProps {
  measurements: Measurement[];
  onDelete: (id: string) => void;
  onClear: () => void;
  onSelect: (id: string) => void;
  selectedId?: string;
}

export default function MeasurementList({
  measurements,
  onDelete,
  onClear,
  onSelect,
  selectedId,
}: MeasurementListProps) {
  if (measurements.length === 0) {
    return (
      <Card className="p-4 bg-background border-border">
        <div className="text-center text-muted-foreground text-sm">
          暂无测量记录
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-background border-border space-y-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">测量记录</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className="h-6 w-6 p-0"
          title="清空所有测量"
        >
          <Trash className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {measurements.map((measurement) => (
          <div
            key={measurement.id}
            onClick={() => onSelect(measurement.id)}
            className={`
              p-2 rounded border cursor-pointer transition-colors
              ${selectedId === measurement.id
                ? 'bg-accent border-accent-foreground'
                : 'bg-muted border-border hover:bg-muted/80'
              }
            `}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm">
                  {measurement.distance.toFixed(2)} {measurement.unit}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(measurement.createdAt).toLocaleTimeString()}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(measurement.id);
                }}
                className="h-6 w-6 p-0"
                title="删除此测量"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
