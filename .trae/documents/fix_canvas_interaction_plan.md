# 画布交互问题修复计划

## 问题分析

### 问题1：图层不能正常被选中、拖动和调整大小

**根本原因**：
- 在 `CanvasViewport.tsx` 中，overlay canvas 始终设置了 `pointer-events: auto`（CSS 第 803-804 行）
- 这导致 overlay canvas 拦截了所有鼠标事件，底层的 fabric canvas 无法接收到点击事件
- 当工具是 `select` 时，overlay 不应该接收事件，应该让底层的 fabric canvas 处理点击

**修复方案**：
- 修改 `workspace__mask-overlay` 的 CSS，默认设置 `pointer-events: none`
- 只有在特殊工具模式（doodle, crop, repair）时才设置 `pointer-events: auto`

### 问题2：平移操作不能在鼠标释放时正确结束

**根本原因**：
- 虽然代码中有 `handleGlobalMouseUp` 监听 window 的 mouseup 和 touchend 事件
- 但 `handleOverlayClick` 函数在处理点击事件时调用了 `event.stopPropagation()`，可能阻止了事件传递

**修复方案**：
- 确保 `handleOverlayClick` 不会阻止事件冒泡到底层 canvas
- 或者在 `stopInteraction` 函数中确保正确重置交互状态

### 问题3：画布区域不能通过 ctrl+鼠标滚轮进行焦点缩放

**根本原因**：
- `handleMouseWheel` 函数检查了 `event.e.ctrlKey`，但在某些情况下可能没有正确获取到 ctrlKey 状态
- 另外，滚轮事件可能被浏览器默认行为阻止

**修复方案**：
- 确保正确检测 ctrlKey 状态
- 确保调用 `event.e.preventDefault()` 来阻止浏览器默认行为

## 修复步骤

### 步骤1：修复图层选择问题

修改 `src/styles/global.css`：
- 将 `.workspace__mask-overlay` 的 `pointer-events` 默认设置为 `none`
- 只有 `.workspace__mask-overlay--interactive` 才设置为 `auto`

### 步骤2：修复平移结束问题

修改 `src/features/editor/components/CanvasViewport.tsx`：
- 检查 `handleOverlayClick` 函数，确保不会阻止事件传递
- 或者确保 `handleGlobalMouseUp` 正确触发

### 步骤3：修复焦点缩放问题

修改 `src/features/editor/components/CanvasViewport.tsx`：
- 确保 `handleMouseWheel` 正确检测 ctrlKey
- 确保正确调用 `preventDefault()`

## 文件修改列表

| 文件路径 | 修改内容 |
|---------|---------|
| `src/styles/global.css` | 修改 `.workspace__mask-overlay` 的 pointer-events 属性 |
| `src/features/editor/components/CanvasViewport.tsx` | 修复平移结束逻辑和滚轮缩放逻辑 |

## 风险评估

1. **低风险**：CSS 修改只影响 overlay canvas 的事件处理
2. **低风险**：事件处理逻辑修改只影响交互行为
3. **低风险**：滚轮事件修改只影响缩放功能

## 验证方法

1. **图层选择**：选择工具后，点击画布上的图层，检查是否能选中并显示调整控制点
2. **平移结束**：按住鼠标拖动画布，然后在画布外释放鼠标，检查平移是否停止
3. **焦点缩放**：按住 Ctrl + 鼠标滚轮，检查画布是否围绕鼠标位置缩放