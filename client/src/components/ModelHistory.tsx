import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Trash, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  getHistoryList,
  removeHistoryEntry,
  clearModelHistory,
  loadModelFromHistory,
} from '@/lib/historyManager';
import { ModelHistoryEntry } from '@/lib/modelManager';

interface ModelHistoryProps {
  onLoadModel: (file: File) => Promise<void>;
  isLoading?: boolean;
}

export default function ModelHistory({ onLoadModel, isLoading = false }: ModelHistoryProps) {
  const [historyList, setHistoryList] = useState<ModelHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 初始加载历史列表
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const entries = await getHistoryList();
      setHistoryList(entries);
    } catch (error) {
      console.error('Failed to load history:', error);
      toast.error('加载历史记录失败');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLoadModel = async (entryId: string) => {
    try {
      setIsLoadingHistory(true);
      const file = await loadModelFromHistory(entryId);
      if (!file) {
        toast.error('模型文件不存在');
        return;
      }
      await onLoadModel(file);
      // 重新加载历史列表以更新访问时间排序
      await loadHistory();
    } catch (error) {
      console.error('Failed to load model from history:', error);
      toast.error('加载模型失败');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await removeHistoryEntry(entryId);
      setHistoryList((prev) => prev.filter((entry) => entry.id !== entryId));
      toast.success('已删除历史记录');
    } catch (error) {
      console.error('Failed to delete history entry:', error);
      toast.error('删除失败');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('确定要清空所有历史记录吗？此操作无法撤销。')) {
      return;
    }

    try {
      await clearModelHistory();
      setHistoryList([]);
      toast.success('已清空所有历史记录');
    } catch (error) {
      console.error('Failed to clear history:', error);
      toast.error('清空失败');
    }
  };

  if (historyList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">暂无历史记录</p>
        <p className="text-xs mt-1">上传模型后会自动保存</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 历史列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 p-3">
        {historyList.map((entry) => (
          <div
            key={entry.id}
            className="bg-background/50 border border-border rounded-lg p-3 hover:bg-background/80 transition-colors"
          >
            {/* 缩略图和基本信息 */}
            <div className="flex gap-3">
              {/* 缩略图 */}
              {entry.thumbDataUrl && (
                <div className="w-16 h-16 flex-shrink-0 rounded bg-background border border-border overflow-hidden">
                  <img
                    src={entry.thumbDataUrl}
                    alt={entry.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate text-foreground">{entry.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(entry.uploadedAt).toLocaleDateString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {entry.stats.meshes} mesh · {entry.stats.triangles.toLocaleString()} 面
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleLoadModel(entry.id)}
                  disabled={isLoading || isLoadingHistory}
                >
                  加载
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDeleteEntry(entry.id)}
                  disabled={isLoading || isLoadingHistory}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 底部操作 */}
      <div className="border-t border-border p-3 bg-background/50">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs"
          onClick={handleClearAll}
          disabled={isLoading || isLoadingHistory || historyList.length === 0}
        >
          <Trash className="w-3 h-3 mr-1" />
          清空历史
        </Button>
      </div>
    </div>
  );
}
