# Plan: Remove Image URL Input Field from AI3D Tool

## Summary
移除 AI3D 工具中的"图片 URL（可选）"输入框，只保留对用户已提交图片进行 3D 化的功能。

## Current State Analysis
- `EditorWorkspace.tsx` 第 361 行定义了 `customImageUrl` 状态
- 第 1047-1065 行渲染了可选的图片 URL 输入框
- `handleAi3d` 函数接受可选的 `customImageUrl` 参数，但实际只会使用用户上传的图片

## Proposed Changes

### 1. 删除 customImageUrl 状态 (line 361)
```tsx
// 删除
const [customImageUrl, setCustomImageUrl] = useState("");
```

### 2. 修改 handleAi3d 函数 (lines 621-660)
- 移除 `customImageUrl` 参数
- 直接使用 `imageLayer.source` 作为目标 URL
- 简化验证逻辑

### 3. 删除 hasCustomUrl 变量 (line ~1032)
```tsx
// 删除
const hasCustomUrl = customImageUrl && (customImageUrl.startsWith("http://") || customImageUrl.startsWith("https://"));
```
同时修改 `canGenerate`：
```tsx
// 修改前
const canGenerate = isUrlImage || isBase64Image || hasCustomUrl;
// 修改后
const canGenerate = isUrlImage || isBase64Image;
```

### 4. 删除 URL 输入框 UI (lines 1047-1065)
删除整个 `<label className="workspace__property workspace__property--inner">` 块

### 5. 更新按钮 onClick (line ~1080)
```tsx
// 修改前
onClick={() => void handleAi3d(customImageUrl)}
// 修改后
onClick={() => void handleAi3d()}
```

## Verification Steps
1. 确认编译无错误
2. 确认 AI3D 工具的 UI 不再显示 URL 输入框
3. 确认生成 3D 模型功能仍然正常工作
