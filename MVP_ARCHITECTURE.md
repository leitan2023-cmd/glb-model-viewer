# 精度数据运营可视化系统 MVP - 架构设计

## 1. 核心数据模型

### 1.1 StableKey 生成策略

```typescript
interface StableKeyInfo {
  stableKey: string;      // 唯一标识
  type: 'uuid' | 'name' | 'path';
  pathKey?: string;       // 遍历路径
}

// 优先级：glTF node.uuid > node.name > pathKey(scene/parent/child/meshIndex)
function generateStableKey(mesh: THREE.Object3D, path: string[]): StableKeyInfo {
  // 1. 尝试 uuid
  if (mesh.uuid) {
    return { stableKey: mesh.uuid, type: 'uuid' };
  }
  
  // 2. 尝试 name
  if (mesh.name && mesh.name !== 'Mesh' && mesh.name !== 'Group') {
    return { stableKey: mesh.name, type: 'name' };
  }
  
  // 3. 使用 pathKey
  const pathKey = path.join('/');
  return { stableKey: pathKey, type: 'path', pathKey };
}
```

### 1.2 ModelId 生成

```typescript
// modelId = hash(fileName + size + mtime)
function generateModelId(file: File): string {
  const key = `${file.name}|${file.size}|${file.lastModified}`;
  return hashString(key); // 使用简单的哈希函数
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
```

### 1.3 构件状态数据结构

```typescript
interface PartState {
  stage?: string;           // 施工阶段
  status?: string;          // 状态（完成/进行中/待处理等）
  updatedAt: number;        // 更新时间
  metrics?: Record<string, any>;  // 其他指标
}

interface ModelState {
  modelId: string;
  parts: {
    [stableKey: string]: PartState;
  };
  createdAt: number;
  updatedAt: number;
}
```

### 1.4 事件记录数据结构

```typescript
interface EventRecord {
  id: string;               // 唯一ID
  modelId: string;          // 所属模型
  type: 'cut_line' | 'bearing' | 'column' | 'backburn';
  title: string;            // 事件标题
  targetKey: string;        // 绑定的构件 stableKey
  targetName: string;       // 构件名称
  createdAt: number;
  updatedAt: number;
  note: string;
  
  // 类型特定字段
  fields: {
    // 切割线
    code?: string;
    remark?: string;
    
    // 搭载定位
    location?: string;
    
    // 立柱
    height?: number;
    verticality?: number;
    
    // 背烧
    area?: number;
    offset?: number;
    reason?: string;
    photo?: string;  // base64 data URL
  };
  
  // 几何数据
  points: Array<{ x: number; y: number; z: number }>;  // 0/1/2 个点
  
  // 附件
  attachments: Array<{ name: string; dataUrl: string }>;
}
```

## 2. 存储设计

### 2.1 IndexedDB 结构

```
Database: glb-model-viewer-db
├── model-blobs (存储GLB文件)
├── model-history (存储模型元信息)
├── model-states (按modelId存储构件状态)
├── event-records (存储事件记录)
└── annotations (存储标注数据)
```

### 2.2 本地状态管理

使用 React Context + Zustand 管理：
- 当前 modelId
- 当前模型的状态数据
- 当前模型的事件列表
- 选中的事件
- 运维模式开关
- 量测模式开关

## 3. 模块划分

### 3.1 核心模块

| 模块 | 职责 | 文件 |
|------|------|------|
| **ModelManager** | 模型加载、替换、资源释放 | `lib/modelManager.ts` |
| **StableKeyManager** | stableKey 生成、维护 | `lib/stableKeyManager.ts` |
| **StateStore** | 状态数据存储和查询 | `lib/stateStore.ts` |
| **EventStore** | 事件记录 CRUD | `lib/eventStore.ts` |
| **AnnotationRenderer** | 标注可视化 | `lib/annotationRenderer.ts` |
| **MeasureTool** | 量测工具 | `lib/measureTool.ts` |

### 3.2 UI 组件

| 组件 | 职责 | 文件 |
|------|------|------|
| **EventList** | 事件列表、搜索、筛选 | `components/EventList.tsx` |
| **EventEditor** | 事件编辑弹窗 | `components/EventEditor.tsx` |
| **StatePanel** | 构件状态展示 | `components/StatePanel.tsx` |
| **AnnotationManager** | 标注管理 UI | `components/AnnotationManager.tsx` |

## 4. 关键流程

### 4.1 模型加载流程

```
上传GLB
  ↓
生成 modelId
  ↓
遍历场景生成 stableKey 映射表
  ↓
加载模型状态数据（如果存在）
  ↓
应用状态着色
  ↓
加载事件列表
  ↓
渲染标注
```

### 4.2 事件创建流程

```
运维模式 ON
  ↓
点击模型表面
  ↓
Raycaster 命中 → 获取 mesh → 查找 stableKey
  ↓
打开事件编辑弹窗
  ↓
选择类型 + 填字段 + 保存
  ↓
存储到 EventStore
  ↓
渲染标注到场景
```

### 4.3 量测流程

```
量测模式 ON
  ↓
第一次点击 → 记录点1 + 显示临时标记
  ↓
第二次点击 → 记录点2 + 计算距离 + 显示线段和标签
  ↓
点击"清除" → 删除临时标注
  ↓
量测模式 OFF → 清理所有临时对象
```

## 5. 颜色映射配置

```typescript
const stageColorMap: Record<string, string> = {
  'planning': '#808080',      // 灰色
  'in_progress': '#FFA500',   // 橙色
  'completed': '#00AA00',     // 绿色
  'delayed': '#FF0000',       // 红色
};

const statusColorMap: Record<string, string> = {
  'pending': '#CCCCCC',
  'in_progress': '#FFA500',
  'completed': '#00AA00',
  'failed': '#FF0000',
};
```

## 6. 实现优先级

### Phase 1（必须）
- StableKey 生成和维护
- ModelId 生成
- 模型状态数据导入和着色
- 基础事件 CRUD

### Phase 2（必须）
- 标注可视化（点、线）
- 量测工具
- 事件列表 UI
- 运维模式开关

### Phase 3（可选）
- 剖切功能
- 复杂测量
- 多人协同
- 后端接口
