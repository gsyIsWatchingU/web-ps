# Plan 工具文件预览功能实现计划

## 概要
为 "/plan" 工具添加在线预览按钮，点击后弹出模态框，支持用户上传 .glb 文件（不上传到画布）进行 3D 模型预览，支持选择文件和拖拽上传两种方式。

## 当前状态分析

### 已有的相关组件
1. **ModelPreviewDialog** (`src/features/editor/components/ModelPreviewDialog.tsx`)
   - 现已支持通过 URL 预览 .glb 模型
   - 包含头部（标题+文件名+关闭按钮）、内容区（GLBModelViewer）、底部（关闭按钮）
   - 样式使用 `.model-preview-dialog__*` CSS 类

2. **GLBModelViewer** (`src/features/editor/components/GLBModelViewer.tsx`)
   - 基于 three.js 的 3D 模型渲染组件
   - 支持 .glb 和 .zip（内含 .glb）格式
   - 已处理本地/远程 URL、Blob URL

3. **EditorWorkspace** (`src/features/editor/components/EditorWorkspace.tsx`)
   - 主工作区组件
   - toolbar 区域有"撤销"、"重做"、"清空"、"导入图片"、"添加花字"、"添加装饰"按钮
   - 已有 `fileInputRef` 用于图片导入

### 缺失的功能
- 没有 "/plan" 工具按钮
- 没有支持拖拽上传的对话框
- 没有不上传到画布、只用于预览的文件上传机制

## 方案设计

### 实现方式
在 EditorWorkspace 的 toolbar 区域添加一个"预览"按钮，点击后打开一个**新的上传预览对话框**，用户可以：
1. 点击按钮选择本地 .glb 文件
2. 拖拽 .glb 文件到对话框区域
3. 文件不上传到画布，直接在对话框内预览

### 复用与扩展
- 复用现有 `GLBModelViewer` 组件进行 3D 渲染
- 复用 `ModelPreviewDialog` 的 CSS 样式和动画效果
- 扩展 `GLBModelViewer` 支持 Blob URL（通过 `URL.createObjectURL`）

## 具体修改

### 1. 创建 GLB 文件上传预览对话框组件
**文件**: `src/features/editor/components/GlbUploadPreviewDialog.tsx`（新文件）

**功能**:
- 拖拽上传区域（支持 .glb 文件）
- 点击上传按钮选择文件
- 预览区域使用 `GLBModelViewer`
- 状态管理：isDragOver、selectedFile、previewUrl

**关键代码结构**:
```tsx
interface GlbUploadPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
}
```

### 2. 修改 GLBModelViewer 支持 Blob URL
**文件**: `src/features/editor/components/GLBModelViewer.tsx`

**修改点**:
- `modelUrl` 支持 Blob URL（通过 `URL.createObjectURL` 创建）
- 移除不必要的 proxy URL 逻辑（仅用于远程 URL）

### 3. 在 EditorWorkspace 添加预览按钮
**文件**: `src/features/editor/components/EditorWorkspace.tsx`

**修改点**:
- 添加状态: `isGlbPreviewOpen: boolean`
- 添加状态: `glbPreviewUrl: string`
- 在 toolbar 区域添加入口按钮（位于"添加装饰"之后）
- 渲染 `<GlbUploadPreviewDialog>`

### 4. 添加拖拽上传样式
**文件**: `src/styles/global.css`

**新增样式**:
- `.glb-upload-dialog__dropzone` - 拖拽上传区域样式
- `.glb-upload-dialog__dropzone--active` - 拖拽悬停状态
- `.glb-upload-dialog__upload-area` - 上传区域布局

## 文件清单
| 操作 | 文件路径 |
|------|----------|
| 新建 | `src/features/editor/components/GlbUploadPreviewDialog.tsx` |
| 修改 | `src/features/editor/components/GLBModelViewer.tsx` |
| 修改 | `src/features/editor/components/EditorWorkspace.tsx` |
| 修改 | `src/styles/global.css` |

## 验证步骤
1. 启动开发服务器 `npm run dev`
2. 在编辑器 toolbar 区找到并点击"预览"按钮
3. 验证模态框正常弹出
4. 验证可以点击选择 .glb 文件
5. 验证可以拖拽 .glb 文件到上传区域
6. 验证 .glb 文件能正常渲染（可旋转、缩放）
7. 验证 ESC 键和关闭按钮能关闭对话框
8. 验证非 .glb 文件被拒绝（显示错误提示）
