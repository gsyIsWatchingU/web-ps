# 涂鸦工具无法使用问题修复计划

## 问题分析

用户反馈涂鸦功能也无法使用画笔涂鸦。

### 代码分析

经过检查，涂鸦功能的核心逻辑是正确的：
1. `handleMouseDown` 中检测到 `currentTool === "doodle"` 时设置绘制模式
2. `handleMouseMove` 中添加涂鸦点并渲染预览
3. `stopInteraction` 中提交涂鸦

### 可能的问题

虽然代码逻辑正确，但可能存在以下问题：
1. **工具切换时状态未重置**：切换工具时，`drawSessionRef.current.mode` 和 `doodlePointsRef.current` 可能没有被正确重置
2. **事件监听器问题**：可能存在事件冲突或监听器注册问题

## 修复方案

### 方案1：工具切换时重置绘制状态

在工具切换时，确保重置绘制相关的状态：
- 重置 `drawSessionRef.current.mode` 为 `null`
- 清空 `doodlePointsRef.current`

### 方案2：确保涂鸦预览正确渲染

检查并修复涂鸦预览的渲染逻辑，确保在涂鸦工具激活时能够正确显示绘制预览。

## 修复步骤

1. 在工具切换的 `useEffect` 中添加状态重置逻辑
2. 验证修复效果

## 涉及文件

- `src/features/editor/components/CanvasViewport.tsx`

## 风险评估

- 低风险：修改仅影响状态重置和预览渲染，不影响核心业务逻辑
- 向后兼容：修复后行为符合预期的默认行为