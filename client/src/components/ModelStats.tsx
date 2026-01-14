import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Card } from '@/components/ui/card';

export interface ModelStatsProps {
  scene: THREE.Group | null;
}

interface Stats {
  meshCount: number;
  triangleCount: number;
  materialCount: number;
  textureCount: number;
  lightCount: number;
}

const ModelStats: React.FC<ModelStatsProps> = ({ scene }) => {
  const stats = useMemo(() => {
    if (!scene) {
      return null;
    }

    const result: Stats = {
      meshCount: 0,
      triangleCount: 0,
      materialCount: 0,
      textureCount: 0,
      lightCount: 0,
    };

    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        result.meshCount++;

        // 计算三角面数
        if (object.geometry) {
          const positionAttribute = object.geometry.getAttribute('position');
          if (positionAttribute) {
            result.triangleCount += positionAttribute.count / 3;
          }
        }

        // 收集材质
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => materials.add(m));
        } else if (object.material) {
          materials.add(object.material);
        }
      } else if (object instanceof THREE.Light) {
        result.lightCount++;
      }
    });

    // 收集纹理
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        if (material.map) textures.add(material.map);
        if (material.normalMap) textures.add(material.normalMap);
        if (material.roughnessMap) textures.add(material.roughnessMap);
        if (material.metalnessMap) textures.add(material.metalnessMap);
        if (material.aoMap) textures.add(material.aoMap);
        if (material.emissiveMap) textures.add(material.emissiveMap);
      }
    });

    result.materialCount = materials.size;
    result.textureCount = textures.size;

    return result;
  }, [scene]);

  if (!stats) {
    return null;
  }

  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="text-sm font-semibold text-foreground mb-3">模型统计</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Mesh 数量</p>
          <p className="text-accent font-mono font-bold">{stats.meshCount}</p>
        </div>
        <div>
          <p className="text-muted-foreground">三角面数</p>
          <p className="text-accent font-mono font-bold">
            {Math.round(stats.triangleCount).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">材质数</p>
          <p className="text-accent font-mono font-bold">{stats.materialCount}</p>
        </div>
        <div>
          <p className="text-muted-foreground">纹理数</p>
          <p className="text-accent font-mono font-bold">{stats.textureCount}</p>
        </div>
        <div>
          <p className="text-muted-foreground">灯光数</p>
          <p className="text-accent font-mono font-bold">{stats.lightCount}</p>
        </div>
      </div>
    </Card>
  );
};

export default ModelStats;
