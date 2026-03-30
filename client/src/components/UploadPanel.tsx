import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export interface UploadPanelProps {
  onFileSelected?: (file: File) => void;
  isLoading?: boolean;
  progress?: number;
}

const UploadPanel: React.FC<UploadPanelProps> = ({
  onFileSelected,
  isLoading = false,
  progress = 0,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.glb') || lowerName.endsWith('.gltf')) {
      onFileSelected?.(file);
    } else {
      alert('请选择 GLB 或 GLTF 格式的文件');
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
        isDragging
          ? 'border-accent bg-accent/10'
          : 'border-border hover:border-accent/50 bg-card/50'
      } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isLoading}
      />
      <div className="flex flex-col items-center gap-3">
        <Upload className="w-8 h-8 text-accent" />
        <div>
          <p className="text-foreground font-medium">拖拽 GLB/GLTF 文件到此处</p>
          <p className="text-sm text-muted-foreground mt-1">或点击选择文件</p>
        </div>
      </div>
      {isLoading && progress > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 rounded-lg">
          <Progress value={progress} className="w-24 mb-2" />
          <p className="text-sm text-foreground">{progress}%</p>
        </div>
      )}
    </div>
  );
};

export default UploadPanel;

