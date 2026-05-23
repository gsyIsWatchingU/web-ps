# 画布视口约束与工作区滚动修正 - 实现计划

## 概述

根据 `plan.md` 的要求，需要调整编辑器画布视口行为，确保画布始终留在编辑区可视范围内，默认进入时采用更合适的纵向偏移，并移除工作区的水平滚动条。

## 修改内容

### 1. CanvasViewport.tsx 修改

#### 1.1 添加视口约束计算函数 `clampPan`

创建一个新函数用于计算允许的 `panX/panY` 范围，基于 `viewportBounds`、画布尺寸和当前 `zoom`。

**约束规则：**
- `panX` 的最小值为 0（画布左边缘不能超出编辑区左侧）
- `panX` 的最大值为 `Math.max(0, viewportBounds.width - canvasWidth * zoom)`（画布右边缘不能超出编辑区右侧）
- `panY` 的最小值为 0（画布上边缘不能超出编辑区顶部）
- `panY` 的最大值为 `Math.max(0, viewportBounds.height - canvasHeight * zoom)`（画布下边缘不能超出编辑区底部）

#### 1.2 修改 `calculateCenteredViewport` 函数

- 保持现有 `zoom` 计算方式不变
- 默认 `panY` 改为约 `70px`（让画布顶部距编辑区约 70px）
- `panX` 仍居中计算
- 最后应用 `clampPan` 约束

#### 1.3 修改拖拽平移逻辑

在 `handleMouseMove` 中的拖拽处理部分（`panSessionRef.current.isPanning` 分支），应用 `clampPan` 约束。

#### 1.4 修改滚轮缩放逻辑

在 `handleMouseWheel` 中的缩放处理部分，缩放后的 `nextPanX` 和 `nextPanY` 需要应用 `clampPan` 约束。

### 2. global.css 修改

修改 `.workspace__viewport-shell`：
- 添加 `overflow-x: hidden` 禁止横向滚动
- 保持 `overflow-y: auto` 保留纵向滚动能力

## 影响范围

- **文件**: `src/features/editor/components/CanvasViewport.tsx`
- **文件**: `src/styles/global.css`

## 测试验证

1. 初次进入编辑器时，画布顶部在编辑区内，视觉上纵向偏移接近 `70px`
2. 不同画布比例下验证默认视口：
   - 宽图场景不再出现左侧越界
   - 高图场景不再出现顶部越界
3. 拖拽平移时，向四个方向拖到边界后会被夹住
4. `Ctrl/Cmd + 滚轮` 缩放后，画布不会被推到编辑区外
5. 工作区不再出现水平滚动条

## 风险评估

- **低风险**: 修改范围明确，不涉及核心业务逻辑
- **回滚方案**: 可恢复到修改前的代码版本