import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { X, Pin } from 'lucide-react';

export interface PickInfoData {
  selectedName: string;
  hitMeshName: string;
  uuid: string;
  triangles?: number;
  meshes?: number;
  worldPos: THREE.Vector3;
}

interface PickInfoCardProps {
  scene: THREE.Scene | null;
  visible: boolean;
  data: PickInfoData | null;
  isPinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
}

export const PickInfoCard: React.FC<PickInfoCardProps> = ({
  scene,
  visible,
  data,
  isPinned,
  onClose,
  onTogglePin,
}) => {
  const css2dObjectRef = useRef<CSS2DObject | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scene) return;

    // 创建 CSS2DObject（只创建一次）
    if (!css2dObjectRef.current) {
      const container = document.createElement('div');
      container.style.width = '240px';
      container.style.padding = '10px';
      container.style.backgroundColor = 'rgba(15, 20, 25, 0.9)';
      container.style.border = '1px solid #00d9ff';
      container.style.borderRadius = '8px';
      container.style.fontSize = '12px';
      container.style.color = '#e0e0e0';
      container.style.fontFamily = 'monospace';
      container.style.pointerEvents = 'none';
      container.style.userSelect = 'none';
      container.style.lineHeight = '1.4';

      const css2dObj = new CSS2DObject(container);
      css2dObj.position.set(0, 0, 0);
      scene.add(css2dObj);
      css2dObjectRef.current = css2dObj;
      containerRef.current = container;
    }

    // 更新内容和位置
    if (visible && data && containerRef.current) {
      const { selectedName, hitMeshName, uuid, triangles, meshes, worldPos } = data;

      // 计算自适应偏移（基于模型大小）
      const offsetDistance = 0.15; // 默认 0.15m
      const offsetPos = worldPos.clone().add(new THREE.Vector3(0, offsetDistance, 0));

      css2dObjectRef.current.position.copy(offsetPos);

      // 构建卡片内容
      const content = `
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px; row-gap: 4px;">
          <span style="color: #00d9ff;">Name:</span>
          <span>${selectedName}</span>
          
          <span style="color: #00d9ff;">Hit Mesh:</span>
          <span>${hitMeshName}</span>
          
          <span style="color: #00d9ff;">UUID:</span>
          <span style="word-break: break-all; font-size: 10px;">${uuid.substring(0, 12)}...</span>
          
          ${triangles !== undefined ? `
            <span style="color: #00d9ff;">Triangles:</span>
            <span>${triangles}</span>
          ` : ''}
          
          ${meshes !== undefined ? `
            <span style="color: #00d9ff;">Meshes:</span>
            <span>${meshes}</span>
          ` : ''}
          
          <span style="color: #00d9ff;">World Pos:</span>
          <span>${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}</span>
        </div>
        
        <div style="margin-top: 8px; display: flex; gap: 4px; justify-content: flex-end;">
          <button id="pin-btn" style="
            background: ${isPinned ? '#00d9ff' : 'transparent'};
            border: 1px solid #00d9ff;
            color: ${isPinned ? '#0f1419' : '#00d9ff'};
            padding: 2px 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-family: monospace;
          ">📌</button>
          <button id="close-btn" style="
            background: transparent;
            border: 1px solid #ff6b6b;
            color: #ff6b6b;
            padding: 2px 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-family: monospace;
          ">×</button>
        </div>
      `;

      containerRef.current.innerHTML = content;

      // 绑定按钮事件（需要 pointer-events: auto 才能点击）
      const pinBtn = containerRef.current.querySelector('#pin-btn') as HTMLButtonElement;
      const closeBtn = containerRef.current.querySelector('#close-btn') as HTMLButtonElement;

      if (pinBtn) {
        pinBtn.style.pointerEvents = 'auto';
        pinBtn.onclick = (e) => {
          e.stopPropagation();
          onTogglePin();
        };
      }

      if (closeBtn) {
        closeBtn.style.pointerEvents = 'auto';
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          onClose();
        };
      }

      css2dObjectRef.current.visible = true;
    } else if (containerRef.current) {
      css2dObjectRef.current!.visible = false;
    }
  }, [scene, visible, data, isPinned, onClose, onTogglePin]);

  return null; // CSS2DObject 直接添加到场景，不需要返回 DOM
};
