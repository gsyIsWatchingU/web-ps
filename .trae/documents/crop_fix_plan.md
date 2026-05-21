# 裁剪功能问题修复计划（续）

## 问题分析

用户报告两个问题：
1. 裁剪框仍然不对齐
2. 不支持手动拖动裁剪

### 问题根因

**问题1**：在 `seedCanvas.ts` 中，`applyCommonProps` 函数会覆盖之前设置的位置，导致预览模式下的位置调整失效。

**问题2**：在 `CanvasViewport.tsx` 中，裁剪拖动的 handle 判断逻辑存在问题，可能导致拖动不生效。

### 修复方案

**修复问题1**：修改 `applyCommonProps` 函数，在预览模式下不覆盖位置设置。

**修复问题2**：检查 `CanvasViewport.tsx` 中的裁剪交互逻辑，确保拖动功能正常工作。

## 修改文件

1. `src/features/editor/runtime/seedCanvas.ts` - 修改 `applyCommonProps` 函数，支持预览模式位置保留
2. `src/features/editor/components/CanvasViewport.tsx` - 检查并修复裁剪拖动逻辑

## 步骤

1. 修改 `seedCanvas.ts`，在预览模式下不覆盖图像位置
2. 检查 `CanvasViewport.tsx` 中的裁剪拖动逻辑
3. 验证修复是否正确

## 风险评估

- 低风险：仅修改裁剪预览的显示和交互逻辑
- 影响范围：仅裁剪功能
