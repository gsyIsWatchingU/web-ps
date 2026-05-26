# web-ps

一个面向电商 AIGC 带货图二次精修的 Web 编辑器原型。项目当前提供可运行的前端工作台、Cloudflare Worker 后端骨架，以及文档与图片上传的 MVP 接口，目标是让用户在网页端完成“导入 -> 编辑 -> 保存 -> 导出”的轻量修图流程。

## 项目功能

当前已具备的核心能力：

- 画布缩放、平移、比例切换与安全区查看
- 图片导入、基础变换、自由裁剪与快捷裁剪
- 图层列表、重命名、排序、隐藏、锁定、复制、删除
- 花字模板、文字样式编辑、装饰层编辑
- 基础滤镜、电商滤镜预设、一键增强
- 撤销 / 重做、草稿自动恢复
- PNG / JPEG 导出
- Cloudflare Worker 文档存储与图片上传接口

当前尚未完成的重点能力：

- 涂抹 / 橡皮擦 / 局部重绘
- 智能扩图
- 图文工作流回填
- 服务端真实预览渲染

## 技术栈

- 前端：React 19、TypeScript、Vite、Ant Design
- 编辑能力：Fabric.js、Three.js
- 状态与校验：Zustand、Zod
- 后端：Cloudflare Workers
- 存储：Cloudflare D1、Cloudflare R2

## 项目结构

```text
.
├─ src/                    前端编辑器主体
├─ public/                 静态资源
├─ backend/worker/         Cloudflare Worker 后端
├─ docs/                   持续维护文档
├─ package.json
└─ vite.config.ts
```

## 快速开始

安装根项目依赖：

```bash
npm install
```

如果需要联调后端，再安装 Worker 子项目依赖：

```bash
cd backend/worker
npm install
cd ../..
```

只启动前端：

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:5173
```

仅前端模式下：

- 不需要配置 `VITE_EDITOR_API_BASE_URL`
- 文档保存、预览与导出走本地回退逻辑

## 前后端联调

1. 启动 Worker：

```bash
cd backend/worker
npm run dev
```

2. 根目录创建或修改 `.env.local`：

```env
VITE_EDITOR_API_BASE_URL=http://127.0.0.1:8787
```

3. 回到根目录启动前端：

```bash
npm run dev
```

联调时当前可用接口：

- `POST /assets/images`
- `GET /documents/:id`
- `POST /documents`
- `PUT /documents/:id`

当前 `POST /renders/preview` 仍返回 `501`，前端应继续使用本地预览回退逻辑。

## 部署说明

根目录常用命令：

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
npm run backend:check
npm run backend:dev
npm run backend:deploy
```

Cloudflare 最短部署流程：

1. 创建 D1 数据库
2. 创建 R2 bucket
3. 执行 D1 migration
4. 修改 `backend/worker/wrangler.toml`
5. 部署 Worker
6. 将前端 `VITE_EDITOR_API_BASE_URL` 指向线上 Worker 地址

示例命令：

```bash
cd backend/worker
npx wrangler d1 create web-ps-editor
npx wrangler r2 bucket create web-ps-editor-assets
npx wrangler d1 execute web-ps-editor --remote --file=./migrations/0001_init.sql
npm run deploy
```

如果本地启动 Worker 时因为 `compatibility_date` 报错，请把 `backend/worker/wrangler.toml` 中的日期改为本地 Wrangler 支持的版本。

## 当前状态

当前仓库已经从“原型骨架”推进到“可运行的轻量电商精修工作台”，但推荐 MVP 仍未完全收口。对外可理解为：

- 已经适合演示导入、编辑、导出主链路
- 已经具备前后端文档存取与图片上传基础能力
- 仍缺少 AI 精修链路和完整服务端渲染闭环

## 文档导航

- `docs/work-roadmap.md`：开发路线与阶段记录
- `docs/feature-list.md`：功能状态清单
- `docs/plan-list.md`：整体计划、当前计划、下一步计划
- `docs/doc-maintenance.md`：文档维护规则与更新工作流

## 开发约定

所有代码变更完成后，必须同步更新以下文档，否则任务不算完成：

- `docs/work-roadmap.md`
- `docs/feature-list.md`
- `docs/plan-list.md`

更新规则见 `docs/doc-maintenance.md`。
