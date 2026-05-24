# web-ps

一个面向图片处理场景的 Web 编辑器项目，定位为轻量级在线修图工作台。项目提供画布编辑、图层管理、裁剪与滤镜、导出，以及 AI 修复和 3D 模型生成等能力，适合作为图片编辑类产品的前端原型或 MVP 基础工程。

## 功能简介

- 多图层画布编辑：支持图片、文字、装饰元素、涂鸦等内容的组合编辑
- 常用编辑能力：支持裁剪、滤镜、画笔、橡皮擦、画布尺寸调整等操作
- 导出能力：支持将当前编辑结果导出为 PNG / JPEG
- AI 能力接入：支持图片修复、扩图类处理，以及基于图片生成 3D 模型
- 帮助与引导：内置帮助面板和示意资源，便于快速上手

## 技术栈

- React 19
- TypeScript
- Vite
- Ant Design
- Fabric.js
- Three.js
- Zustand
- Zod

## 目录结构

```text
.
├─ public/                  静态资源与帮助图示
├─ src/
│  ├─ app/                  应用入口与整体壳层
│  ├─ features/editor/
│  │  ├─ components/        编辑器界面与交互组件
│  │  ├─ model/             编辑器数据模型与 schema
│  │  ├─ runtime/           导出、滤镜、AI 接入等运行时能力
│  │  └─ store/             Zustand 状态管理
│  ├─ shared/               通用组件与共享能力
│  └─ styles/               全局样式与编辑器样式
├─ docs/                    需求、设计、流程、产品文档
├─ index.html
├─ package.json
└─ vite.config.ts
```

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址：

- `http://localhost:5173`

常用命令：

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
```

## AI 配置

如果需要启用 AI 修复或 3D 生成功能，需要在 `.env` 中配置相关环境变量：

```env
VITE_AI_BASE_URL=
VITE_AI_API_KEY=
VITE_AI_MODEL=
VITE_AI_REPAIR_MODEL=
VITE_AI_TIMEOUT_MS=
```

开发环境下，Vite 已配置 `/api/ai` 代理，便于本地调试 AI 接口。

## 文档说明

根目录 README 仅用于 GitHub 首页快速介绍。更详细的产品、设计和研发文档请查看：

- [docs/README.md](./docs/README.md)
- [docs/product/vision.md](./docs/product/vision.md)
- [docs/product/roadmap.md](./docs/product/roadmap.md)
- [docs/specs/2026-05-editor-mvp/spec.md](./docs/specs/2026-05-editor-mvp/spec.md)
- [docs/specs/2026-05-editor-mvp/design.md](./docs/specs/2026-05-editor-mvp/design.md)
