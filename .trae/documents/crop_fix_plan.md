# 裁剪功能问题修复计划

## 问题分析

用户报告点击裁剪后出现一个远超图片大小的红框。

### 问题根因

在 `CanvasViewport.tsx` 的 `getCropPreviewBounds` 函数中，裁剪框的宽高没有应用图层的缩放变换：

```typescript
function getCropPreviewBounds(layer: ImageLayer, crop: ImageCrop) {
  return {
    imageX: layer.transform.x,
    imageY: layer.transform.y,
    imageWidth: layer.originalWidth * layer.transform.scaleX,
    imageHeight: layer.originalHeight * layer.transform.scaleY,
    cropX: layer.transform.x + crop.x,          // crop.x 未乘以 scaleX
    cropY: layer.transform.y + crop.y,          // crop.y 未乘以 scaleY
    cropWidth: crop.width,                       // crop.width 未乘以 scaleX
    cropHeight: crop.height                      // crop.height 未乘以 scaleY
  };
}
```

当图片被缩放到画布上时（例如 scaleX = 0.3），`crop.x`, `crop.y`, `crop.width`, `crop.height` 仍然是原始图像坐标，没有应用缩放，导致裁剪框显示过大。

### 修复方案

修改 `getCropPreviewBounds` 函数，将裁剪区域的坐标和尺寸都应用图层的缩放变换：

```typescript
function getCropPreviewBounds(layer: ImageLayer, crop: ImageCrop) {
  const scaleX = layer.transform.scaleX || 1;
  const scaleY = layer.transform.scaleY || 1;
  
  return {
    imageX: layer.transform.x,
    imageY: layer.transform.y,
    imageWidth: layer.originalWidth * scaleX,
    imageHeight: layer.originalHeight * scaleY,
    cropX: layer.transform.x + crop.x * scaleX,
    cropY: layer.transform.y + crop.y * scaleY,
    cropWidth: crop.width * scaleX,
    cropHeight: crop.height * scaleY
  };
}
```

## 修改文件

- `src/features/editor/components/CanvasViewport.tsx` - 修改 `getCropPreviewBounds` 函数

## 步骤

1. 读取当前 `CanvasViewport.tsx` 文件中的 `getCropPreviewBounds` 函数
2. 修改函数，添加缩放变换到裁剪区域的坐标和尺寸
3. 验证修复是否正确

## 风险评估

- 低风险：仅修改裁剪预览的显示逻辑，不影响实际的裁剪数据
- 影响范围：仅裁剪功能的可视化预览
