import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EventRecord, EventType } from '@/lib/eventStore';

export interface EventEditorProps {
  open: boolean;
  event?: EventRecord | null;
  targetKey: string;
  targetName: string;
  points: Array<{ x: number; y: number; z: number }>;
  onSave: (event: Omit<EventRecord, 'id' | 'createdAt' | 'updatedAt' | 'modelId'>) => void;
  onCancel: () => void;
}

const EventEditor: React.FC<EventEditorProps> = ({
  open,
  event,
  targetKey,
  targetName,
  points,
  onSave,
  onCancel,
}) => {
  const [type, setType] = useState<EventType>(event?.type || 'bearing');
  const [title, setTitle] = useState(event?.title || '');
  const [note, setNote] = useState(event?.note || '');
  const [fields, setFields] = useState(event?.fields || {});

  const handleSave = () => {
    if (!title.trim()) {
      alert('请输入事件标题');
      return;
    }

    onSave({
      type,
      title,
      note,
      targetKey,
      targetName,
      fields,
      points,
      attachments: event?.attachments || [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? '编辑事件' : '新建事件'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 类型选择 */}
          <div>
            <label className="text-sm font-medium">事件类型</label>
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cut_line">切割线</SelectItem>
                <SelectItem value="bearing">搭载定位</SelectItem>
                <SelectItem value="column">立柱</SelectItem>
                <SelectItem value="backburn">背烧</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 标题 */}
          <div>
            <label className="text-sm font-medium">标题</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入事件标题"
            />
          </div>

          {/* 目标构件 */}
          <div>
            <label className="text-sm font-medium">目标构件</label>
            <Input value={targetName} disabled className="bg-muted" />
          </div>

          {/* 备注 */}
          <div>
            <label className="text-sm font-medium">备注</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="输入备注信息"
              className="w-full h-20 px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>

          {/* 类型特定字段 */}
          {type === 'cut_line' && (
            <>
              <div>
                <label className="text-sm font-medium">代码</label>
                <Input
                  value={fields.code || ''}
                  onChange={(e) => setFields({ ...fields, code: e.target.value })}
                  placeholder="输入代码"
                />
              </div>
            </>
          )}

          {type === 'bearing' && (
            <>
              <div>
                <label className="text-sm font-medium">位置</label>
                <Input
                  value={fields.location || ''}
                  onChange={(e) => setFields({ ...fields, location: e.target.value })}
                  placeholder="输入位置"
                />
              </div>
            </>
          )}

          {type === 'column' && (
            <>
              <div>
                <label className="text-sm font-medium">高度 (m)</label>
                <Input
                  type="number"
                  value={fields.height || ''}
                  onChange={(e) => setFields({ ...fields, height: parseFloat(e.target.value) })}
                  placeholder="输入高度"
                />
              </div>
              <div>
                <label className="text-sm font-medium">垂直度 (mm)</label>
                <Input
                  type="number"
                  value={fields.verticality || ''}
                  onChange={(e) => setFields({ ...fields, verticality: parseFloat(e.target.value) })}
                  placeholder="输入垂直度"
                />
              </div>
            </>
          )}

          {type === 'backburn' && (
            <>
              <div>
                <label className="text-sm font-medium">面积 (m²)</label>
                <Input
                  type="number"
                  value={fields.area || ''}
                  onChange={(e) => setFields({ ...fields, area: parseFloat(e.target.value) })}
                  placeholder="输入面积"
                />
              </div>
              <div>
                <label className="text-sm font-medium">偏移 (mm)</label>
                <Input
                  type="number"
                  value={fields.offset || ''}
                  onChange={(e) => setFields({ ...fields, offset: parseFloat(e.target.value) })}
                  placeholder="输入偏移"
                />
              </div>
              <div>
                <label className="text-sm font-medium">原因</label>
                <Input
                  value={fields.reason || ''}
                  onChange={(e) => setFields({ ...fields, reason: e.target.value })}
                  placeholder="输入原因"
                />
              </div>
            </>
          )}

          {/* 点数信息 */}
          <div className="text-sm text-muted-foreground">
            已记录 {points.length} 个点
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventEditor;
