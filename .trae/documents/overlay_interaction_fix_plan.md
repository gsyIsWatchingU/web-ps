# Overlay 交互事件拦截问题修复计划

## 问题分析

用户反馈涂鸦功能无法使用，根本原因是 overlay 拦截了所有鼠标事件！

### 问题细节

1. 当使用 "doodle", "crop", "repair" 工具时，overlay 会添加类 `workspace__mask-overlay--interactive`
2. 这个类设置 `pointer-events: auto;`，拦截所有鼠标事件
3. 但 overlay 只设置了 `onClick` 事件，没有处理 `onMouseDown`, `onMouseMove`, `onMouseUp` 事件
4. 真正的事件处理逻辑是在 fabric.js canvas 上的，但事件被 overlay 拦截了，所以无法绘制

### 代码结构

- overlay 在 canvas 上面，是绝对定位的
- 当工具是 "doodle", "crop", "repair" 时，`pointer-events` 变为 `auto`
- 但 overlay 只处理了 `onClick` 事件，其他事件没有处理

## 修复方案

### 方案1：在 overlay 上添加完整事件处理（推荐）

在 overlay 上添加 `onMouseDown`, `onMouseMove`, `onMouseUp` 事件处理函数，并调用内部的处理逻辑。

### 方案2：让 overlay 不拦截鼠标事件（备选）

改变事件策略，让事件透传到下面的 canvas，但这可能影响其他功能。

## 修复步骤

1. 在 CanvasViewport 中添加完整的 overlay 事件处理函数
2. 修改 overlay 元素，添加所有需要的事件处理
3. 验证修复效果

## 涉及文件

- `src/features/editor/components/CanvasViewport.tsx`

## 风险评估

- 中风险：需要修改事件处理机制，可能影响其他交互功能
- 向后兼容：修复后行为应该保持一致