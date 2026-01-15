import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

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

/**
 * 浮动标签卡 - 使用 CSS2DObject 实现屏幕空间卡片
 * 必须与 CSS2DRenderer 配合使用
 */
export const PickInfoCard: React.FC<PickInfoCardProps> = ({
  scene,
  visible,
  data,
  isPinned,
  onClose,
  onTogglePin,
}) => {
  const css2dObjectRef = useRef<CSS2DObject | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scene) return;

    // 创建 CSS2DObject（只创建一次）
    if (!css2dObjectRef.current) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 240px;
        padding: 10px;
        background: rgba(7, 18, 26, 0.95);
        border: 1px solid #00e5ff;
        border-radius: 8px;
        font-size: 12px;
        color: #8ff;
        font-family: monospace;
        pointer-events: auto;
        user-select: none;
        line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0, 229, 255, 0.2);
      `;

      const css2dObj = new CSS2DObject(el);
      css2dObj.position.set(0, 0, 0);
      scene.add(css2dObj);
      css2dObjectRef.current = css2dObj;
      elementRef.current = el;
    }

    // 更新内容和位置
    if (visible && data && elementRef.current) {
      const { selectedName, hitMeshName, uuid, triangles, meshes, worldPos } = data;

      // 计算自适应偏移（沿 y 轴向上）
      const offsetDistance = 0.15;
      const offsetPos = worldPos.clone().add(new THREE.Vector3(0, offsetDistance, 0));

      css2dObjectRef.current.position.copy(offsetPos);

      // 构建卡片内容
      let content = `<div style="display: grid; grid-template-columns: auto 1fr; gap: 8px; row-gap: 4px;">
        <span style="color: #00e5ff;">Name:</span>
        <span>${selectedName}</span>
        
        <span style="color: #00e5ff;">Hit:</span>
        <span>${hitMeshName}</span>
        
        <span style="color: #00e5ff;">UUID:</span>
        <span style="word-break: break-all; font-size: 10px;">${uuid.substring(0, 12)}...</span>`;

      if (triangles !== undefined) {
        content += `
        <span style="color: #00e5ff;">Tri:</span>
        <span>${triangles}</span>`;
      }

      if (meshes !== undefined) {
        content += `
        <span style="color: #00e5ff;">Mesh:</span>
        <span>${meshes}</span>`;
      }

      content += `
        <span style="color: #00e5ff;">Pos:</span>
        <span>${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}</span>
      </div>
      
      <div style="margin-top: 8px; display: flex; gap: 4px; justify-content: flex-end;">
        <button id="pin-btn" style="
          background: ${isPinned ? '#00e5ff' : 'transparent'};
          border: 1px solid #00e5ff;
          color: ${isPinned ? '#0f1419' : '#00e5ff'};
          padding: 2px 6px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          font-family: monospace;
          transition: all 0.2s;
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
          transition: all 0.2s;
        ">×</button>
      </div>`;

      elementRef.current.innerHTML = content;

      // 绑定按钮事件
      const pinBtn = elementRef.current.querySelector('#pin-btn') as HTMLButtonElement;
      const closeBtn = elementRef.current.querySelector('#close-btn') as HTMLButtonElement;

      if (pinBtn) {
        pinBtn.onclick = (e) => {
          e.stopPropagation();
          onTogglePin();
        };
      }

      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          onClose();
        };
      }

      css2dObjectRef.current.visible = true;
    } else if (css2dObjectRef.current) {
      css2dObjectRef.current.visible = false;
    }
  }, [scene, visible, data, isPinned, onClose, onTogglePin]);

  return null; // CSS2DObject 直接添加到场景，不需要返回 DOM
};
