# 修复计划：安全区提示关闭按钮和AI3D任务状态问题

## 问题分析

### 问题1：安全区提示无法通过手动点击右上角的关闭按钮关闭

**原因**：在 `CanvasViewport.tsx` 中，`handleMouseDown` 函数在检测点击是否在关闭按钮区域时，使用的坐标转换逻辑可能存在问题。`mapClientPointToDocument` 函数将客户端坐标转换为文档坐标，但 `drawSafeAreaOverlay` 返回的关闭按钮矩形也是文档坐标，理论上应该匹配。

**根本原因**：点击检测逻辑在检测到关闭按钮点击后直接 `return`，但由于事件绑定在 fabric Canvas 上，而安全区提示绘制在 overlay canvas 上，事件可能没有正确传递。

### 问题2：显示"创作中... 正在创建任务..."，但是后台没有发出任何任务状态的查询

**原因**：在 `useEditorStore.ts` 的 `applyAi3d` 函数中，在调用 `runSeed3dTask` 之前就将任务状态设置为 `"pending"`，但 `runSeed3dTask` 内部首先调用 `createSeed3dTask`，而 `createSeed3dTask` 在 `hasAiConfig()` 返回 false 时会直接返回失败状态，不发起任何网络请求。

这导致界面显示"创作中..."但实际上没有发起任何 API 请求。

## 修复方案

### 修复1：安全区提示关闭按钮

修改 `CanvasViewport.tsx` 中 `handleMouseDown` 函数，确保关闭按钮点击检测正确工作。

### 修复2：AI3D 任务状态管理

修改 `useEditorStore.ts` 中的 `applyAi3d` 函数，确保只有在任务真正创建成功后才更新状态为 "pending"，并确保错误状态正确更新。

## 文件修改

1. **src/features/editor/components/CanvasViewport.tsx**
   - 修改 `handleMouseDown` 函数中的关闭按钮点击检测逻辑

2. **src/features/editor/store/useEditorStore.ts**
   - 修改 `applyAi3d` 函数，优化任务状态更新逻辑

## 实施步骤

1. 修改 CanvasViewport.tsx 中的安全区提示关闭按钮检测
2. 修改 useEditorStore.ts 中的 applyAi3d 函数
3. 验证修复效果
