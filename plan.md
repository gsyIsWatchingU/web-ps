# 立体创作替换圈选重绘实施计划

## Summary

将现有“圈选蒙版重绘”链路整体替换为 `立体创作` 单工具入口，接入火山引擎 `Doubao-Seed3D-2.0` 异步任务 API，产物以“任务状态 + 下载入口”形式呈现，不回写 2D 画布、不做站内 3D 预览。

本次按纯前端架构实施：

- API 配置改为 `import.meta.env`
- 前端调用创建任务并轮询状态
- 本地开发继续通过 Vite 代理转发到 `https://ark.cn-beijing.volces.com`
- 首版对参考图输入采用“仅支持可访问 URL”的约束；本地上传/`data:` 图层在立体创作面板中明确提示暂不支持

## Key Changes

### 1. 工具与交互收敛

- `EditorTool` 精简为保留 `ai3d`，移除 `brush`、`eraser`、`repair` 的业务入口；`crop`、`doodle` 等其他工具维持现状。
- [src/features/editor/components/EditorWorkspace.tsx](/E:/new-study/web-ps/src/features/editor/components/EditorWorkspace.tsx) 中：
  - 删除与蒙版模式、蒙版按钮、调整执行按钮、蒙版预览、调整状态提示相关的 UI 和本地状态。
  - 将右侧属性区替换为 `立体创作` 面板：参考图说明、提示词输入、开始生成按钮、任务状态、错误信息、下载链接/文件名。
  - 未选中图片图层时显示“请选择图片图层”；选中但图片 `source` 非 `http(s)` 时显示“当前图片无法用于立体创作，首版仅支持可访问 URL 图层”。
- [src/features/editor/components/CanvasViewport.tsx](/E:/new-study/web-ps/src/features/editor/components/CanvasViewport.tsx) 中：
  - 删除 `MaskSelectionMode`、`MaskDraft`、`onMaskStart/onMaskAppend/onMaskFinish`、蒙版绘制与预览逻辑。
  - 将直接交互工具判断从 `["brush","crop","doodle"]` 收敛为仅保留仍真实存在的交互工具，避免立体创作影响画布行为。
  - 保留裁剪与涂鸦逻辑，不再处理任何圈选调整输入。

### 2. 数据模型与草稿兼容

- [src/features/editor/model/document.ts](/E:/new-study/web-ps/src/features/editor/model/document.ts) 中：
  - 删除 `MaskPoint`、`MaskStroke`、`ImageMask`、`createDefaultImageMask`。
  - 从 `ImageLayer` 中移除 `mask`。
  - 将 `editorToolIds` 调整为包含 `ai3d`、不再包含 `brush | eraser | repair`。
  - `ImageAiMeta` 保留 `prompt`、`expandPrompt`、`lastAiRequestedAt`、`lastAiSucceededAt`、`lastAiError`，并固定 `lastAiAction` 为 `"seed3d" | "outpaint" | null`。
  - `model3dTask` 作为立体创作状态容器，字段定为：
    - `taskId: string | null`
    - `status: "idle" | "pending" | "running" | "succeeded" | "failed"`
    - `downloadUrl: string | null`
    - `fileName: string | null`
    - `providerModel: string | null`
- `createDefaultImageAiMeta()` 默认返回空任务状态，避免任何蒙版遗留字段。
- [src/features/editor/model/document.schema.ts](/E:/new-study/web-ps/src/features/editor/model/document.schema.ts) 中：
  - 移除 `mask` schema。
  - `imageLayerSchema` 保持 `.passthrough()`，以便本地旧草稿中遗留的 `mask` 字段被平滑忽略而不是报错。
  - `lastAiAction` 枚举同步移除 `inpaint`。
  - `model3dTask` 设置默认值，确保旧草稿恢复时自动补全。
- `buildPersistedDraft()` 不再清理蒙版状态，只保留时间戳更新等必要逻辑。

### 3. Store 与立体创作异步任务流

- [src/features/editor/store/useEditorStore.ts](/E:/new-study/web-ps/src/features/editor/store/useEditorStore.ts) 中：
  - 删除 `updateMaskBrushSize`、`toggleMaskPreview`、`clearMask`、`startMaskStroke`、`appendMaskPoint`、`finishMaskStroke`、`applyAiRepair`。
  - 保留 `updateAiPrompt`、`updateAiExpandPrompt`、`applyAiExtend`；扩图链路不在本次替换范围内。
  - 新增 `applyAi3d(layerId): Promise<AsyncResult>`，职责固定为：
    - 校验图层存在且为图片图层
    - 校验 `source` 为 `http://` 或 `https://`
    - 校验 AI 配置完整
    - 写入 `lastAiAction: "seed3d"`、`lastAiRequestedAt`、`lastAiError: null`
    - 初始化 `model3dTask = { taskId: null, status: "pending", downloadUrl: null, fileName: null, providerModel }`
    - 调用 runtime 创建任务
    - 写回 `taskId` 和初始状态
    - 在 store 内完成轮询，并在每次状态变化时更新 `model3dTask.status`
    - 成功后写入 `downloadUrl`、`fileName`、`providerModel`、`lastAiSucceededAt`
    - 失败后写入 `lastAiError` 并将状态置为 `failed`
  - 立体创作任务完成后不修改 `ImageLayer.source`、`crop`、`transform` 或其他画布内容。
- 轮询归 store 持有，不放在组件里：
  - 组件只负责触发和展示状态。
  - 好处是状态统一落盘，页面重渲染不丢失当前任务状态。
  - 不要求“刷新页面后继续追任务”；首版仅保证同次会话内轮询完成。

### 4. AI Bridge / 配置 / 代理

- [src/features/editor/runtime/aiConfig.ts](/E:/new-study/web-ps/src/features/editor/runtime/aiConfig.ts) 改为从 `import.meta.env` 读取：
  - `VITE_AI_BASE_URL`
  - `VITE_AI_API_KEY`
  - `VITE_AI_MODEL`，默认 `doubao-seed3d-2-0-260328`
  - `VITE_AI_TIMEOUT_MS`，默认保留现有超时量级
- [src/features/editor/runtime/aiBridge.ts](/E:/new-study/web-ps/src/features/editor/runtime/aiBridge.ts) 从 DashScope 图片调整桥接重构为 Seed3D 任务桥接：
  - 暴露 `createSeed3dTask({ imageUrl, prompt })`
  - 暴露 `pollSeed3dTask(taskId)`
  - 可选暴露 `runSeed3dTask()` 供 store 一次性调用创建+轮询
  - 创建请求使用：
    - `POST /api/v3/contents/generations/tasks`
    - body 形如 `{ model, content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl } }] }`
  - 查询请求使用：
    - `GET /api/v3/contents/generations/tasks/{id}`
  - 删除接口本次不接 UI，只保留后续可扩展空间
  - 统一返回归一化结果结构，至少包含：
    - `taskId`
    - `status`
    - `downloadUrl`
    - `fileName`
    - `providerModel`
    - `errorMessage`
- Seed3D 状态归一化规则：
  - 创建成功后未知/排队状态映射为 `pending`
  - 处理中映射为 `running`
  - 完成映射为 `succeeded`
  - 失败/取消/未知异常映射为 `failed`
- 下载地址提取策略：
  - 从任务成功响应的结果数组中取首个可下载 URL
  - 文件名优先取服务端显式字段；没有则从 URL 路径回退解析
- 错误文案统一为立体创作语义，覆盖：
  - 未配置环境变量
  - API Key 无效/无权限
  - 余额或额度不足
  - 网络失败
  - 轮询超时
  - 任务失败
  - 非 `http(s)` 参考图不支持
- [vite.config.ts](/E:/new-study/web-ps/vite.config.ts) 代理改为：
  - `/api/ai` -> `https://ark.cn-beijing.volces.com`
  - rewrite 到 `/api/v3`
- [src/vite-env.d.ts](/E:/new-study/web-ps/src/vite-env.d.ts) 增补环境变量类型声明。

### 5. 文案与帮助系统

- [src/main.tsx](/E:/new-study/web-ps/src/main.tsx) 不再引入 `editor-repair-selection.css`；对应样式文件可删除或并入全局清理计划。
- [src/features/editor/components/HelpCenter.tsx](/E:/new-study/web-ps/src/features/editor/components/HelpCenter.tsx)、[README.md](/E:/new-study/web-ps/README.md)、`public/help/*` 中：
  - 替换“圈选调整 / 局部重绘 / 擦除圈选 / 执行重绘”为 `立体创作`
  - 删除蒙版圈选步骤说明
  - 新增立体创作使用说明：选择参考图、填写提示词、发起生成、等待任务、下载模型
  - `public/help/ai-repair.svg` 替换为立体创作对应示意图，或改名后同步引用
- `EditorWorkspace` 中的配置提示从“修改 aiConfig.ts”改为“配置 `.env` / `import.meta.env`”。

## Public Interfaces / Types

- `EditorTool`：移除 `brush | eraser | repair`，保留 `ai3d`
- `ImageLayer`：移除 `mask`
- `ImageAiMeta.lastAiAction`：限定为 `"seed3d" | "outpaint" | null`
- `ImageAiMeta.model3dTask`：作为公开任务状态类型保留
- `useEditorStore`：
  - 删除蒙版相关 action
  - 新增 `applyAi3d(layerId)`
- `aiBridge`：
  - 从“返回 `imageDataUrl`”改为“返回任务状态与下载信息”

## Test Plan

- 选中图片图层时显示 `立体创作` 面板；未选中图片时显示引导提示。
- 图片 `source` 为非 `http(s)` 时，立体创作面板显示不支持提示，提交按钮禁用。
- 未配置 `VITE_AI_BASE_URL / VITE_AI_API_KEY / VITE_AI_MODEL` 时，面板显示明确配置提示。
- 发起立体创作时按钮进入 loading，重复点击被阻止。
- 创建任务成功后，状态能从 `pending/running` 刷新到最终态。
- 任务失败时显示具体错误，`model3dTask.status` 为 `failed`，不修改原图层内容。
- 任务成功时显示文件名和下载入口，`lastAiSucceededAt` 更新，原 2D 画布图像保持不变。
- 本地草稿恢复时，旧文档即使带有 `mask` 字段也能正常载入并被忽略。
- 扩图链路仍可编译并继续使用现有 `expandPrompt`。
- `npm run typecheck` 与 `npm run build` 通过。

## Assumptions

- 首版立体创作仅提供“生成并下载 3D 资产”，不做站内预览、导入或回写。
- 项目继续保持纯前端架构，不新增后端代理或上传服务。
- 参考图输入首版仅支持可访问的 `http(s)` 图片 URL；本地上传/`data:` 图层不纳入本次能力范围。
- Seed3D 成功响应中至少会提供一个可下载结果 URL；若字段名与当前预期不一致，实现时以实际响应做最小映射调整。
- `AI 扩图` 保留，且本次不重构其业务流程，只处理与共享 AI 配置/错误文案相关的必要兼容。
