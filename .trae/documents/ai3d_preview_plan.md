# AI3D 在线预览功能实现计划

## 需求分析

用户希望在 AI3D 任务完成后，除了下载功能外，增加在线预览 3D 模型的功能。点击"在线预览"按钮后，弹出一个可以查看 3D 视图的弹窗，支持旋转、缩放等交互操作。

## 技术方案

### 1. 依赖安装

需要安装 Three.js 库来渲染 3D 模型：
- `three`: Three.js 核心库
- `@types/three`: TypeScript 类型定义

### 2. 组件设计

#### 2.1 GLBModelViewer 组件
- 使用 Three.js 加载并渲染 GLB/GLTF 格式的 3D 模型
- 支持鼠标交互（旋转、缩放、平移）
- 提供默认光照和相机设置

#### 2.2 ModelPreviewDialog 组件
- 弹窗容器，包含关闭按钮和 3D 预览区域
- 响应式设计，适配不同屏幕尺寸

### 3. 修改现有代码

#### 3.1 EditorWorkspace.tsx
- 在 AI3D 工具属性面板中添加"在线预览"按钮
- 添加弹窗状态管理
- 处理预览和关闭事件

#### 3.2 global.css
- 添加弹窗和 3D 预览容器的样式

## 实现步骤

| 序号 | 任务 | 描述 | 关联文件 |
|:---|:---|:---|:---|
| 1 | 安装依赖 | 安装 Three.js 和类型定义 | package.json |
| 2 | 创建 GLBModelViewer 组件 | 实现 3D 模型渲染逻辑 | src/features/editor/components/GLBModelViewer.tsx |
| 3 | 创建 ModelPreviewDialog 组件 | 实现弹窗 UI | src/features/editor/components/ModelPreviewDialog.tsx |
| 4 | 修改 EditorWorkspace.tsx | 添加预览按钮和弹窗状态 | src/features/editor/components/EditorWorkspace.tsx |
| 5 | 添加样式 | 完善弹窗和预览容器的样式 | src/styles/global.css |
| 6 | 测试构建 | 验证项目能正常构建 | - |

## 风险评估

| 风险 | 描述 | 应对措施 |
|:---|:---|:---|
| 依赖兼容性 | Three.js 版本可能与现有依赖冲突 | 使用稳定版本 r160 |
| 性能问题 | 复杂 3D 模型可能导致性能下降 | 添加加载状态和模型简化处理 |
| 跨域问题 | 模型 URL 可能存在 CORS 限制 | 使用代理或提醒用户注意 |
| 浏览器兼容性 | 某些浏览器可能不支持 WebGL | 添加降级提示 |

## 预期结果

- AI3D 任务成功后，显示"下载模型"和"在线预览"两个按钮
- 点击"在线预览"按钮，弹出包含 3D 模型的弹窗
- 用户可以通过鼠标交互旋转、缩放模型
- 弹窗支持关闭操作