# 局部重绘工具画笔选中问题修复计划

## 问题分析

用户反馈点击局部重绘工具后没有默认选中画笔，点击画笔按钮也没有反应。

### 根本原因

经过代码分析，发现两个关键问题：

1. **画笔按钮激活状态判断问题**（EditorWorkspace.tsx:1014）：
   - 当前逻辑：`activeRepairSession?.toolMode !== "eraser" ? "is-active" : ""`
   - 当 `activeRepairSession` 为 `null` 时，按钮无法显示为激活状态

2. **画笔按钮点击无响应**（useEditorStore.ts:1532-1544）：
   - `setRepairToolMode` 函数在 `repairSession` 为 `null` 时直接返回，不执行任何操作
   - 导致点击画笔按钮时无法切换模式

### 状态初始化时序问题

在 `setActiveTool` 函数中（useEditorStore.ts:605-608），切换工具时会将其他工具的 session 设置为 `null`：
```typescript
repairSession: tool === "repair" ? state.repairSession : null
```

虽然有 `useEffect` 在切换到 repair 工具时初始化 session，但由于 React 状态更新是异步的，按钮点击可能在 session 初始化完成前发生。

## 修复方案

### 方案1：修改画笔按钮的激活状态判断

修改 `EditorWorkspace.tsx` 中画笔按钮的 className 判断逻辑：
- 当 `activeTool === "repair"` 且 `activeRepairSession` 为 `null` 时，默认显示画笔为激活状态

### 方案2：修改画笔按钮的 onClick 处理

确保在调用 `setRepairToolMode` 前，repairSession 已初始化：
- 在 onClick 中检查 `activeRepairSession`，如果为 `null` 则先调用 `startRepairSession`

## 修复步骤

1. 修改 `EditorWorkspace.tsx` 第1014行的画笔按钮激活状态判断
2. 修改 `EditorWorkspace.tsx` 第1015行的 onClick 处理逻辑
3. 验证修复效果

## 涉及文件

- `src/features/editor/components/EditorWorkspace.tsx`

## 风险评估

- 低风险：修改仅影响 UI 显示和点击处理，不影响核心业务逻辑
- 向后兼容：修复后行为符合预期的默认行为