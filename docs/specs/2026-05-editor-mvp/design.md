# Editor MVP Design

## 元信息

- Status: draft
- Owner: frontend
- Last Updated: 2026-05-15
- Related Spec: `docs/specs/2026-05-editor-mvp/spec.md`
- Related ADR: `ADR 0001`

## 方案概述

首版采用 `React + TypeScript + Fabric.js` 构建编辑器工作台。视图层负责工具栏、面板和交互入口，编辑运行时负责 Fabric canvas 生命周期和事件桥接，业务层通过 `EditorDocument + Layer + Command` 模型统一管理状态、历史栈、导出和草稿恢复。

设计原则：

- 业务模型与 Fabric object 解耦
- 历史栈记录用户意图级操作
- 导出和草稿恢复围绕 `EditorDocument` 而不是 UI 状态展开
- 为未来 AI 精修保留服务层扩展口

## 关键模块划分

- `Editor Shell`
  - 顶部工具栏、左侧图层区、中央画布区、右侧属性面板、底部缩放区
- `Canvas Runtime`
  - Fabric canvas 初始化、事件监听、选中态桥接、缩放平移、辅助线
- `Document Store`
  - 当前文档、图层树、选中状态、历史游标、草稿元信息
- `Command Layer`
  - `execute / undo / redo / serialize / deserialize / export`
- `Asset Services`
  - 图片加载、字体加载、草稿持久化、导出适配

## 公共接口或类型变化

建议新增核心类型：

- `EditorDocument`
- `CanvasModel`
- `LayerBase`
- `ImageLayer`
- `TextLayer`
- `DecorationLayer`
- `Command`
- `ExportOptions`
- `DraftMeta`

建议新增核心接口：

- `execute(command)`
- `undo()`
- `redo()`
- `serialize()`
- `deserialize(document)`
- `exportImage(options)`

兼容策略：

- 首版不直接暴露 Fabric object 给业务层。
- 面板操作统一转化为命令执行，避免旁路修改状态。

## 状态管理与数据流

主状态流：

1. 用户在 UI 触发操作。
2. 操作被转换成业务命令。
3. Command Layer 更新 `Document Store`。
4. Runtime 根据最新文档状态同步到 Fabric canvas。
5. 成功操作写入历史栈，并触发草稿持久化。

关键状态拆分：

- `documentState`
  - 当前画布与图层数据
- `selectionState`
  - 当前选中的图层 id 列表和交互模式
- `historyState`
  - undo/redo 游标与命令记录
- `uiState`
  - 面板开关、缩放级别、当前工具等暂态信息

## 渲染与交互策略

- 画布比例变更采用“更新 CanvasModel + 重排视图”的方式处理，不直接依赖 DOM 缩放。
- 图层排序以业务层 `zIndex` 为准，再同步到底层对象层级。
- 花字样式以文字层扩展样式字段表达，由样式渲染器映射到 Fabric text 配置。
- 滤镜修改优先使用 Fabric 可支持能力；若存在明显不足，在不改变业务模型前提下补充自定义处理。
- 草稿恢复优先恢复 `EditorDocument`，再重建 runtime 对象，不做对象级直接序列化恢复。

## 非功能要求

- 性能：
  - 大图导入优先使用浏览器原生解码能力，避免主线程阻塞过久。
  - 拖拽和连续样式调整时对草稿保存做节流。
- 异常处理：
  - 导入失败、字体加载失败、草稿解析失败时提供默认兜底。
  - 导出失败时保留当前编辑状态，不清空历史。
- 埋点/日志：
  - MVP 至少预留操作日志接口，记录导入、导出、撤销、恢复等核心行为。
- 草稿恢复：
  - 使用本地持久化保存最新文档快照与更新时间，支持启动恢复提示。

## 风险与替代方案

- 风险：
  - Fabric.js 在复杂文字样式和后续像素级涂抹上存在上限。
  - 图层状态与 runtime 对象同步不严谨时，容易引发撤销/重做错乱。
  - 导出结果与编辑态不一致会直接影响用户信任。
- 替代方案：
  - 若后续确认强依赖局部精修，可将像素级能力拆到独立渲染模块。
  - 若文字效果无法满足业务场景，可引入样式预设和局部自定义渲染兜底。

## 测试要点

- 图层操作、滤镜修改和文字样式修改是否都能稳定进入历史栈
- 画布比例切换前后图层状态是否可预期
- 草稿恢复与导出链路是否基于同一文档状态
- 常见浏览器下大图导入和多图层操作是否稳定
