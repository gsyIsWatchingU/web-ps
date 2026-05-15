# Editor MVP Tasks

## 元信息

- Status: active
- Owner: frontend
- Related Spec: `docs/specs/2026-05-editor-mvp/spec.md`
- Related Design: `docs/specs/2026-05-editor-mvp/design.md`

## 开发任务

### T1. 编辑器骨架与文档模型

- Status: done
- Owner: frontend
- Depends on: `AC-1`, `AC-3`
- Acceptance: 建立 Editor Shell、Fabric canvas 容器、`EditorDocument` 与基础 `Layer` 类型，支持空画布初始化。
- Notes: 已完成首版工程脚手架，包含 Vite/React/Fabric.js 基础结构、Editor Store、文档模型和可运行的画布占位视图。

### T2. 画布比例与安全区

- Status: done
- Owner: frontend
- Depends on: T1
- Acceptance: 支持 `1:1 / 3:4 / 4:5 / 9:16 / 自定义` 画布比例切换，并能在 UI 中显示安全区。
- Notes: 已完成比例切换与安全区渲染，切换时会按新画布尺寸对图层位置和缩放做比例映射。

### T3. 图片导入与基础变换

- Status: done
- Owner: frontend
- Depends on: T1
- Acceptance: 支持导入图片并完成缩放、旋转、翻转，裁切能力至少有明确占位或首版实现策略。
- Notes: 已支持本地图片导入并自动生成图片图层，属性面板可完成缩放、旋转、水平翻转、垂直翻转；裁切保留了明确扩展位。

### T4. 图层面板与层级管理

- Status: done
- Owner: frontend
- Depends on: T1, T3
- Acceptance: 支持 `image / text / decoration` 三类图层的显示、隐藏、锁定、重命名、复制、删除和排序。
- Notes: 已完成图层列表、选中联动和层级管理，支持显示隐藏、锁定、重命名、复制、删除和上下移动。

### T5. 花字样式系统

- Status: todo
- Owner: frontend
- Depends on: T1, T4
- Acceptance: 文字层支持 `描边 / 阴影 / 渐变 / 背景条` 四类样式，并可通过属性面板调整。
- Notes: 对应 `AC-4`。

### T6. 基础滤镜

- Status: todo
- Owner: frontend
- Depends on: T3
- Acceptance: 图片层支持 `亮度 / 对比度 / 饱和度 / 模糊 / 锐化 / 色温` 调节，并在画布中即时预览。
- Notes: 对应 `AC-5`。

### T7. 历史栈与命令层

- Status: todo
- Owner: frontend
- Depends on: T2, T4, T5, T6
- Acceptance: 连续操作至少 20 次后，`undo / redo` 与画布视觉状态保持一致。
- Notes: 对应 `AC-6`。

### T8. 草稿恢复与导出

- Status: todo
- Owner: frontend
- Depends on: T7
- Acceptance: 支持本地草稿恢复和 PNG/JPEG 导出，导出结果尺寸与配置一致。
- Notes: 对应 `AC-7`, `AC-8`。

## 联调任务

### I1. 图层与 runtime 同步校验

- Status: todo
- Owner: frontend
- Depends on: T4, T7
- Acceptance: 图层面板状态、当前选中态和实际画布对象状态一致。
- Notes: 重点检查排序、隐藏、锁定和复制场景。

### I2. 样式与导出一致性校验

- Status: todo
- Owner: frontend
- Depends on: T5, T6, T8
- Acceptance: 花字样式和滤镜在编辑态与导出图中保持一致。
- Notes: 防止运行态与导出态渲染差异。

## 自测任务

### Q1. 主链路自测

- Status: todo
- Owner: frontend
- Depends on: T8
- Acceptance: 完成“导入 -> 编辑 -> 撤销/重做 -> 刷新恢复 -> 导出”全链路自测并记录结果。
- Notes: 覆盖至少一个带货图真实样例。

### Q2. 稳定性自测

- Status: todo
- Owner: frontend
- Depends on: T8
- Acceptance: 在 10 到 20 个图层下完成多次样式调整、图层排序和导出，不出现严重错乱。
- Notes: 重点关注草稿恢复和历史栈一致性。

## 文档更新任务

### D1. 文档回写

- Status: todo
- Owner: frontend
- Depends on: T1, T8, Q1, Q2
- Acceptance: `spec.md`、`design.md`、`tasks.md` 根据最终实现结果回写完成，关键长期决策同步到 ADR。
- Notes: 未完成不视为 done。

## Done Definition

- `AC-1` 到 `AC-8` 至少完成一轮自测验证
- `spec.md`、`design.md`、`tasks.md` 已同步到最新实现
- 主链路自测结果可追踪
- 如出现关键设计变化，已更新 ADR 或 design
