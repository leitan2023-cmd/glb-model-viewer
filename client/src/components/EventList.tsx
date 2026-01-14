import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EventRecord, EventType, deleteEventRecord } from '@/lib/eventStore';

export interface EventListProps {
  events: EventRecord[];
  selectedEventId?: string;
  onSelectEvent: (event: EventRecord) => void;
  onEditEvent: (event: EventRecord) => void;
  onDeleteEvent: (eventId: string) => void;
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  cut_line: '切割线',
  bearing: '搭载定位',
  column: '立柱',
  backburn: '背烧',
};

const EventList: React.FC<EventListProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  onEditEvent,
  onDeleteEvent,
}) => {
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<EventType | 'all'>('all');
  const [filteredEvents, setFilteredEvents] = useState(events);

  useEffect(() => {
    let result = events;

    // 按类型筛选
    if (filterType !== 'all') {
      result = result.filter((e) => e.type === filterType);
    }

    // 按搜索文本筛选
    if (searchText.trim()) {
      const lowerSearch = searchText.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(lowerSearch) ||
          e.note.toLowerCase().includes(lowerSearch) ||
          e.targetName.toLowerCase().includes(lowerSearch)
      );
    }

    setFilteredEvents(result);
  }, [events, searchText, filterType]);

  const handleDelete = async (eventId: string) => {
    if (confirm('确定要删除这条事件记录吗？')) {
      await deleteEventRecord(eventId);
      onDeleteEvent(eventId);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 p-3">
      {/* 搜索和筛选 */}
      <div className="space-y-2">
        <Input
          placeholder="搜索事件..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="h-8"
        />

        <Select value={filterType} onValueChange={(v) => setFilterType(v as EventType | 'all')}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="cut_line">切割线</SelectItem>
            <SelectItem value="bearing">搭载定位</SelectItem>
            <SelectItem value="column">立柱</SelectItem>
            <SelectItem value="backburn">背烧</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 事件列表 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            {events.length === 0 ? '暂无事件记录' : '没有匹配的事件'}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`p-2 border rounded-md cursor-pointer transition-colors ${
                selectedEventId === event.id
                  ? 'bg-accent/20 border-accent'
                  : 'bg-card hover:bg-card/80 border-border'
              }`}
              onClick={() => onSelectEvent(event)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{event.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {EVENT_TYPE_LABELS[event.type]} · {event.targetName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(event.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                    title="定位"
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditEvent(event);
                    }}
                    title="编辑"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(event.id);
                    }}
                    title="删除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 统计信息 */}
      {events.length > 0 && (
        <div className="text-xs text-muted-foreground border-t border-border pt-2">
          共 {events.length} 条记录，显示 {filteredEvents.length} 条
        </div>
      )}
    </div>
  );
};

export default EventList;
