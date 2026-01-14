# GLB 模型管理系统设计文档

## 1. 核心数据结构

### 1.1 历史记录条目结构

```typescript
interface ModelHistoryEntry {
  id: string;                    // 唯一标识 (nanoid)
  name: string;                  // 模型名称（可编辑）
  originalFileName: string;      // 原始文件名
  size: number;                  // 文件大小（字节）
  uploadedAt: number;            // 上传时间戳
  stats: {
    meshes: number;              // mesh 数量
    triangles: number;           // 三角面数
    materials: number;           // 材质数
    textures: number;            // 纹理数
  };
  thumbDataUrl: string;          // 缩略图 (base64 data URL)
  blobKey: string;               // IndexedDB 存储的 blob key
  lastAccessedAt: number;        // 最后访问时间（用于排序）
}
```

### 1.2 IndexedDB 数据库结构

```typescript
// 数据库名称：glb-model-viewer-db
// 版本：1

// ObjectStore 1: model-blobs
// keyPath: "key"
// 存储：{ key: string, blob: Blob, createdAt: number }

// ObjectStore 2: model-history
// keyPath: "id"
// 存储：ModelHistoryEntry（不包含 blob，只存 blobKey 引用）
```

## 2. 核心函数签名

### 2.1 模型加载和替换

```typescript
/**
 * 主入口：从 File 对象加载模型并替换当前场景
 * @param file - 用户选择的 .glb 或 .gltf 文件
 * @param options - 可选配置
 * @returns 加载成功后的模型统计信息
 */
async function loadModelFromFile(
  file: File,
  options?: {
    skipHistory?: boolean;  // 是否跳过历史保存（默认 false）
    skipThumbnail?: boolean; // 是否跳过缩略图生成（默认 false）
  }
): Promise<ModelStats>;

/**
 * 内部：清理旧模型并释放资源
 * @param root - 要清理的场景根节点
 */
function disposeOldModel(root: THREE.Object3D): void;

/**
 * 内部：递归释放 geometry/material/texture
 * @param obj - 要遍历的对象
 */
function disposeObject3D(obj: THREE.Object3D): void;

/**
 * 内部：完整的模型替换流程
 * @param file - 要加载的文件
 * @returns 模型统计信息
 */
async function replaceModel(file: File): Promise<ModelStats>;
```

### 2.2 历史记录管理

```typescript
/**
 * 保存当前模型到历史记录
 * @param file - 原始文件
 * @param stats - 模型统计信息
 * @param thumbDataUrl - 缩略图 data URL
 * @returns 保存后的历史条目 ID
 */
async function saveToHistory(
  file: File,
  stats: ModelStats,
  thumbDataUrl: string
): Promise<string>;

/**
 * 从历史记录加载模型
 * @param entryId - 历史条目 ID
 * @returns 加载成功后的模型统计信息
 */
async function loadFromHistory(entryId: string): Promise<ModelStats>;

/**
 * 获取所有历史记录（按最近访问时间排序）
 * @returns 历史条目数组
 */
async function getHistoryList(): Promise<ModelHistoryEntry[]>;

/**
 * 删除单条历史记录
 * @param entryId - 要删除的条目 ID
 */
async function deleteHistoryEntry(entryId: string): Promise<void>;

/**
 * 清空所有历史记录
 */
async function clearHistory(): Promise<void>;

/**
 * 更新历史条目的最后访问时间
 * @param entryId - 条目 ID
 */
async function updateLastAccessedAt(entryId: string): Promise<void>;
```

### 2.3 缩略图生成

```typescript
/**
 * 为当前模型生成缩略图
 * @param renderer - Three.js renderer
 * @param scene - 场景
 * @param camera - 相机
 * @param width - 缩略图宽度（默认 256）
 * @param height - 缩略图高度（默认 256）
 * @returns 缩略图 data URL
 */
async function generateThumbnail(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width?: number,
  height?: number
): Promise<string>;
```

### 2.4 模型统计

```typescript
interface ModelStats {
  meshes: number;
  triangles: number;
  materials: number;
  textures: number;
  fileSize: number;
  fileName: string;
}

/**
 * 计算模型统计信息
 * @param root - 模型根节点
 * @param fileSize - 文件大小
 * @param fileName - 文件名
 * @returns 统计信息
 */
function calculateModelStats(
  root: THREE.Object3D,
  fileSize: number,
  fileName: string
): ModelStats;
```

## 3. 关键资源释放代码

### 3.1 完整的 dispose 流程

```typescript
function disposeObject3D(obj: THREE.Object3D): void {
  // 遍历所有子节点
  obj.traverse((child) => {
    // 释放 geometry
    if (child instanceof THREE.Mesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }

      // 释放 material（可能是单个或数组）
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            disposeMaterial(mat);
          });
        } else {
          disposeMaterial(child.material);
        }
      }
    }

    // 释放 SkinnedMesh 的骨架
    if (child instanceof THREE.SkinnedMesh) {
      if (child.skeleton) {
        child.skeleton.dispose();
      }
    }
  });
}

function disposeMaterial(material: THREE.Material): void {
  // 释放纹理
  Object.keys(material).forEach((key) => {
    const value = (material as any)[key];
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  });

  // 释放材质本身
  material.dispose();
}

function disposeOldModel(root: THREE.Object3D): void {
  // 1. 递归释放所有资源
  disposeObject3D(root);

  // 2. 从场景中移除
  root.parent?.remove(root);

  // 3. 清空引用
  root.clear();
}
```

### 3.2 IndexedDB 清理

```typescript
async function cleanupOldBlobs(): Promise<void> {
  const db = await openDatabase();
  const historyStore = db.transaction('model-history', 'readonly').objectStore('model-history');
  const allEntries = await historyStore.getAll();

  // 保留最近 20 条，删除旧的
  if (allEntries.length > 20) {
    const toDelete = allEntries
      .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
      .slice(20);

    const blobStore = db.transaction('model-blobs', 'readwrite').objectStore('model-blobs');
    for (const entry of toDelete) {
      await blobStore.delete(entry.blobKey);
    }
  }
}
```

## 4. 状态流转图

```
用户上传文件
    ↓
loadModelFromFile(file)
    ↓
disposeOldModel(oldRoot) ← 释放旧资源
    ↓
loadGLB(file) ← 解析新文件
    ↓
addToScene(newRoot)
    ↓
buildSceneTree(newRoot) ← 重建树
    ↓
collectPickables(newRoot) ← 重建拾取列表
    ↓
fitCamera(newRoot) ← 重置相机
    ↓
calculateModelStats(newRoot) ← 计算统计
    ↓
generateThumbnail() ← 生成缩略图
    ↓
saveToHistory(file, stats, thumb) ← 保存历史
    ↓
更新 UI（统计、树、历史列表）
```

## 5. 内存管理策略

| 操作 | 内存处理 |
|------|--------|
| 加载新模型前 | 调用 `disposeOldModel()` 释放旧 geometry/material/texture |
| 历史记录超过 20 条 | 删除最早的记录及其 blob |
| 用户清空历史 | 删除所有历史条目和对应的 blob |
| 缩略图生成 | 使用离屏 canvas，生成后立即释放 |

## 6. 错误处理

```typescript
// 所有异步操作需要 try-catch
try {
  await loadModelFromFile(file);
} catch (error) {
  if (error instanceof FileParseError) {
    // 文件格式错误
  } else if (error instanceof StorageError) {
    // IndexedDB 错误
  } else {
    // 其他错误
  }
}
```

## 7. 性能指标

- 模型替换时间：< 500ms（不包括 Draco 解码）
- 缩略图生成：< 100ms
- 历史列表加载：< 50ms
- IndexedDB 查询：< 20ms

## 8. 实现优先级

1. **P0**：disposeOldModel + loadModelFromFile + 基础替换逻辑
2. **P1**：IndexedDB 持久化 + 历史列表管理
3. **P1**：缩略图生成 + UI 展示
4. **P2**：性能优化（虚拟滚动、离屏渲染等）
