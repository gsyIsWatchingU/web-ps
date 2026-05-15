# Web 修图工作台

基于 `React + TypeScript + Vite + Fabric.js` 的 Web 端修图工作台，面向 AIGC 带货图文生成后的二次精修场景。项目按仓库内的 `Spec-Driven Development` 体系持续迭代，当前已经完成文档真相源、前端脚手架，以及 MVP 的 `T1-T4` 基础能力落地。

## 项目功能

当前已实现：

- 画布比例切换：支持 `1:1 / 3:4 / 4:5 / 9:16 / 自定义`
- 安全区展示：画布内显示安全区边界，便于投放素材排版
- 图片导入：支持本地图片导入并生成图片图层
- 基础变换：支持对选中图层做缩放、旋转、水平翻转、垂直翻转
- 图层管理：支持图层选中、重命名、显示隐藏、锁定、复制、删除、上下移动
- 运行时渲染：基于 `Fabric.js` 按文档模型真实渲染图片层、文字层、装饰层

规划中但尚未完成：

- 花字样式系统
- 基础滤镜
- 撤销重做
- 本地草稿恢复
- 导出链路

## 项目亮点

- `SDD 驱动开发`
  - 产品愿景、路线图、领域模型、ADR、功能 spec/design/tasks 都在仓库内维护。
- `文档模型优先`
  - 业务层围绕 `EditorDocument + Layer + CanvasModel` 组织，避免直接把渲染库对象当业务状态。
- `运行时与业务解耦`
  - 视图层、store、runtime 已拆分，后续补命令系统、历史栈和导出时不需要推翻现有结构。
- `带货图场景导向`
  - 画布比例、安全区、图层包装和文本装饰的结构都围绕电商带货图修图链路设计。

## 技术栈

- `React 19`
  - 负责工作台 UI、面板交互和页面结构。
- `TypeScript`
  - 负责编辑器模型、状态和运行时接口的类型约束。
- `Vite`
  - 负责本地开发和构建。
- `Fabric.js`
  - 负责画布对象渲染和后续编辑器能力扩展。
- `Zustand`
  - 负责编辑器状态管理。
- `Zod`
  - 负责文档模型校验。

## 目录结构

```text
.
├─ docs/
│  ├─ adr/                   # 长期有效的关键技术决策
│  ├─ domain/                # 领域模型与统一术语
│  ├─ process/               # SDD 开发流程和门禁规则
│  ├─ product/               # 愿景与路线图
│  ├─ specs/                 # 每个功能包的 spec/design/tasks
│  └─ templates/             # 文档模板
├─ src/
│  ├─ app/                   # 应用入口和顶层页面
│  ├─ features/editor/
│  │  ├─ components/         # 编辑器 UI 组件
│  │  ├─ model/              # 文档模型和 schema
│  │  ├─ runtime/            # Fabric.js 画布运行时
│  │  └─ store/              # Zustand 状态管理
│  └─ styles/                # 全局样式
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## 运行方式

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

默认会在 `http://localhost:5173` 启动本地开发服务。

### 3. 常用命令

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
```

- `npm run dev`
  - 启动本地开发服务
- `npm run build`
  - 先做 TypeScript 检查，再构建生产包
- `npm run preview`
  - 预览构建结果
- `npm run typecheck`
  - 仅做类型检查

## 开发说明

### 当前里程碑

当前已完成 `Editor MVP` 的：

- `T1` 编辑器骨架与文档模型
- `T2` 画布比例与安全区
- `T3` 图片导入与基础变换
- `T4` 图层面板与层级管理

### 当前实现边界

- 裁切能力当前只保留了属性占位和迭代入口，尚未进入真实交互实现
- 当前画布仍以“文档驱动渲染”为主，尚未接入撤销重做和对象级编辑事件回写
- 导出、草稿恢复、滤镜和花字高级样式会继续按 SDD 文档迭代

## 相关文档

- [文档中心](./docs/README.md)
- [产品愿景](./docs/product/vision.md)
- [路线图](./docs/product/roadmap.md)
- [开发流程](./docs/process/dev-workflow.md)
- [Editor MVP Spec](./docs/specs/2026-05-editor-mvp/spec.md)
- [Editor MVP Design](./docs/specs/2026-05-editor-mvp/design.md)
- [Editor MVP Tasks](./docs/specs/2026-05-editor-mvp/tasks.md)
