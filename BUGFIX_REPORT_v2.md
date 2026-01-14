# GLB Viewer 关键问题修复报告 v2

## 修复概述

本次修复解决了两个关键问题：

1. **相机聚焦导致模型飞出视野**：添加完整的防爆逻辑，包括 world matrix 更新、bbox 校验、距离 clamp、相机 near/far 自适应、失败回滚。

2. **3D 点击拾取无反应**：修复 Raycaster NDC 计算、mesh 映射、向上查找等问题。

---

## 问题 1：相机聚焦导致模型飞出视野（已修复）

### 根因分析

**问题现象**：点击树节点（如 Mesh_261001）后相机聚焦逻辑导致模型飞出视野，画面空白。

**根本原因**：
1. World matrix 未更新，导致 bbox 计算错误
2. 距离计算无上下限保护，可能产生无限大的距离
3. 相机 near/far 未自适应，导致裁剪错误
4. 无失败回滚机制

### 修复方案

**修复位置**：`client/src/lib/cameraManager.ts`（完全重写）

#### 1. World Matrix 更新（关键）

```typescript
private updateWorldMatrix(object: THREE.Object3D): void {
  object.updateWorldMatrix(true, true);  // 更新自身和所有子对象
  if (this.scene) {
    this.scene.updateMatrixWorld(true);  // 更新整个场景
  }
}
```

#### 2. 包围盒校验

```typescript
private isValidBoundingBox(box: THREE.Box3): { valid: boolean; reason?: string } {
  // 检查是否为空
  if (box.isEmpty()) {
    return { valid: false, reason: '该节点无有效几何体' };
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // 检查中心点是否有效
  if (!isFinite(center.x) || !isFinite(center.y) || !isFinite(center.z)) {
    return { valid: false, reason: '包围盒中心点无效' };
  }

  // 检查尺寸是否在合理范围
  if (maxDim < this.MIN_BBOX_SIZE) {
    return { valid: false, reason: '对象过小，无法聚焦' };
  }

  if (maxDim > this.MAX_BBOX_SIZE) {
    return { valid: false, reason: '对象过大，无法聚焦' };
  }

  return { valid: true };
}
```

#### 3. 距离计算（带 clamp）

```typescript
private calculateCameraDistance(box: THREE.Box3, padding: number = 1.2): number {
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // 基于 FOV 计算距离
  const fov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
  let distance = maxDim / (2 * Math.tan(fov));

  // 应用填充系数
  distance *= padding;

  // 计算距离限制
  const minDist = maxDim * 0.8;
  const maxDist = maxDim * 10;

  // 应用上下限
  distance = this.clamp(distance, minDist, maxDist);

  // 最终的全局限制
  distance = this.clamp(distance, this.MIN_DISTANCE, this.MAX_DISTANCE);

  return distance;
}
```

#### 4. 相机位置计算（沿当前朝向退后）

```typescript
// 获取当前相机方向
const direction = this.camera.position.clone().sub(this.controls.target).normalize();

// 计算新的相机位置
const newPos = center.clone().add(direction.multiplyScalar(distance));
```

#### 5. Near/Far 自适应

```typescript
// 自适应 near/far 以避免裁剪
const maxDim = Math.max(size.x, size.y, size.z);
this.camera.near = Math.max(distance / 1000, 0.01);
this.camera.far = Math.max(distance * 100, 2000);
this.camera.updateProjectionMatrix();
```

#### 6. 失败回滚机制

```typescript
// 保存当前状态以便失败回滚
const prevState = this.saveCameraState();

try {
  // ... 聚焦逻辑 ...
} catch (error) {
  console.error('聚焦失败:', error);
  toast.error('聚焦失败，已回滚到上一视角');
  this.restoreCameraState(prevState);
}
```

#### 7. 可见性检查

```typescript
private canSeeTarget(targetCenter: THREE.Vector3, distance: number): boolean {
  // 检查目标点是否在相机前方
  const toTarget = targetCenter.clone().sub(this.camera.position);
  const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
  
  const dotProduct = toTarget.dot(cameraDirection);
  
  // 如果点积为负，说明目标在相机后方
  if (dotProduct < 0) {
    return false;
  }

  // 检查距离是否合理
  if (distance <= 0 || !isFinite(distance)) {
    return false;
  }

  return true;
}
```

### 验收标准

✅ 连续点击不同 Mesh 节点，不会出现画面空白/模型飞走
✅ 即使某个节点无几何体，也不会破坏当前视角
✅ 聚焦后相机能看到选中对象
✅ 距离合理，不会太近或太远

---

## 问题 2：3D 点击拾取无反应（已修复）

### 根因分析

**问题现象**：在 3D 视窗里点击模型表面，无法选中/无法反向定位到左侧树节点。

**根本原因**：
1. Raycaster NDC 计算使用了错误的坐标系统
2. 拾取到 mesh 后无法正确映射回树节点
3. 缺少向上查找父节点的逻辑

### 修复方案

#### 1. 正确的 NDC 计算

**修复位置**：`client/src/lib/pickingUtils.ts`

```typescript
private getMouseNDC(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement  // ✅ 使用 canvas，而不是 container
): THREE.Vector2 | null {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  // 确保坐标在 canvas 范围内
  if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
    return null;
  }

  this.mouse.x = (x / rect.width) * 2 - 1;
  this.mouse.y = -(y / rect.height) * 2 + 1;

  return this.mouse;
}
```

#### 2. Mesh 映射和向上查找

**修复位置**：`client/src/lib/sceneGraph.ts`

在构建场景树时，给每个 Object3D 打标：

```typescript
// 在 generateSceneTree 中
(object as any).__nodeId = nodeId;
```

添加向上查找函数：

```typescript
export function findNearestNodeIdInAncestors(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  
  while (current) {
    const nodeId = (current as any).__nodeId;
    if (nodeId) {
      return nodeId;
    }
    current = current.parent;
  }
  
  return null;
}
```

#### 3. 完整的拾取流程

**修复位置**：`client/src/lib/pickingUtils.ts`

```typescript
pick(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement
): PickResult | null {
  if (!this.scene || this.pickableObjects.length === 0) return null;

  // 1. 获取鼠标 NDC 坐标
  const mouseNDC = this.getMouseNDC(clientX, clientY, canvas);
  if (!mouseNDC) return null;

  // 2. 设置射线
  this.raycaster.setFromCamera(this.mouse, camera);

  // 3. 执行射线交集测试
  const intersects = this.raycaster.intersectObjects(this.pickableObjects, true);

  if (intersects.length === 0) {
    return null;
  }

  // 4. 获取最近的交集
  const intersection = intersects[0];
  const mesh = intersection.object as THREE.Mesh;

  // 5. 向上查找最近的有 nodeId 的父串
  const nodeId = findNearestNodeIdInAncestors(mesh);
  
  let node: TreeNode | null = null;
  if (nodeId && this.sceneTree) {
    node = findNodeById(this.sceneTree, nodeId);
  }

  return {
    mesh,
    point: intersection.point.clone(),
    distance: intersection.distance,
    node,
  };
}
```

### 验收标准

✅ 在 3D 里点击任意构件，左侧树能跳到对应节点并高亮
✅ 点击空白处可以取消选择
✅ 支持连续点击不同部件进行快速切换

---

## 代码位置快速查询

| 功能 | 文件 | 关键行 |
|------|------|--------|
| 相机防爆逻辑 | `client/src/lib/cameraManager.ts` | 全文 |
| World matrix 更新 | `client/src/lib/cameraManager.ts` | 35-41 |
| 包围盒校验 | `client/src/lib/cameraManager.ts` | 47-72 |
| 距离计算 clamp | `client/src/lib/cameraManager.ts` | 87-107 |
| 失败回滚 | `client/src/lib/cameraManager.ts` | 148-165 |
| 可见性检查 | `client/src/lib/cameraManager.ts` | 167-183 |
| NDC 计算 | `client/src/lib/pickingUtils.ts` | 41-62 |
| 向上查找 | `client/src/lib/sceneGraph.ts` | 182-198 |
| 拾取流程 | `client/src/lib/pickingUtils.ts` | 71-115 |

---

## 性能考虑

### 相机聚焦性能

- **World matrix 更新**：O(n)，其中 n 为对象数量（仅在聚焦时调用）
- **包围盒计算**：O(m)，其中 m 为 mesh 数量（仅在聚焦时调用）
- **平滑过渡**：使用 requestAnimationFrame，与渲染循环同步

### 拾取性能

- **Raycaster 计算**：O(1)
- **交集测试**：O(k log k)，其中 k 为可拾取对象数量
- **向上查找**：O(d)，其中 d 为对象深度（通常很小）

---

## 测试清单

- [x] 相机不会飞出视野
- [x] 包围盒无效时不会破坏视角
- [x] 距离计算有合理的上下限
- [x] Near/far 自适应避免裁剪
- [x] 失败时能回滚到上一视角
- [x] 3D 点击能定位到树节点
- [x] 向上查找能找到最近的有效节点
- [x] 点击空白处能取消选择
- [ ] 大文件性能测试（100MB+）
- [ ] 不同分辨率和 DPI 设备

---

## 后续建议

1. **键盘快捷键**：添加 Delete 键删除选中节点、F 键自动聚焦、R 键重置视角等。

2. **模型对比功能**：支持同时加载两个 GLB 模型进行并排对比。

3. **测量和标注工具**：添加距离测量、角度测量、文字标注等工具。
