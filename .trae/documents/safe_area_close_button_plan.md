# 安全区关闭按钮修复计划

## 问题分析

用户反馈安全区的关闭按钮无法关闭。经过代码分析，发现以下问题：

1. **CSS 样式问题**：`.workspace__mask-overlay` 和 `.workspace__mask-overlay--interactive` 都设置了 `pointer-events: none`，导致 overlay canvas 无法接收鼠标事件。

2. **事件处理绑定位置**：点击事件处理绑定在 fabric.js 的 `runtime`（底层 canvas）上，而安全区提示和关闭按钮绘制在 overlay canvas 上。

3. **坐标计算不一致**：`drawSafeAreaOverlay` 返回的关闭按钮位置是基于 `effectiveViewport` 计算的，而 `handleMouseDown` 中使用的是 `currentDocument.canvas.viewport`，两者可能不同步。

## 修复方案

### 方案一：修改 CSS pointer-events 属性（推荐）

将 overlay canvas 的 `pointer-events` 设置为 `auto`，并直接在 overlay canvas 上绑定点击事件处理器。

**优点**：
- 直接在绘制关闭按钮的 canvas 上处理点击事件
- 坐标计算更直接，不需要复杂的视口转换
- 代码逻辑更清晰

**缺点**：
- 需要添加额外的事件监听器

### 方案二：修复坐标转换逻辑

确保 `handleMouseDown` 中使用与 `drawSafeAreaOverlay` 相同的视口参数进行坐标转换。

**优点**：
- 不需要修改现有的事件处理架构
- 改动较小

**缺点**：
- 代码逻辑较复杂
- 可能引入其他问题

## 实施计划

### 步骤 1：修改 CSS 样式
- 将 `.workspace__mask-overlay` 的 `pointer-events` 改为 `auto`
- 保持 `.workspace__mask-overlay--interactive` 的 `pointer-events` 为 `auto`

### 步骤 2：在 CanvasViewport 组件中添加 overlay canvas 的点击事件处理
- 在 overlay canvas 上绑定 `onClick` 事件
- 在事件处理函数中计算点击位置是否在关闭按钮区域内
- 如果是，调用 `setIsSafeAreaHintDismissed(true)`

### 步骤 3：测试验证
- 运行项目测试关闭按钮功能
- 确保其他功能不受影响

## 文件修改

1. `src/styles/global.css` - 修改 pointer-events 属性
2. `src/features/editor/components/CanvasViewport.tsx` - 添加 overlay 点击事件处理

## 风险评估

- 低风险：修改仅限于 CSS 和事件处理，不影响核心画布功能
- 需要确保 overlay canvas 的点击事件不会干扰 fabric canvas 的交互（如选择、拖拽等）