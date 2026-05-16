# Web 修图项目文档中心

本目录是项目的 SDD 真相源，默认使用 `Spec-Driven Development` 推进需求、设计、任务和验收。目标不是增加流程负担，而是让每一次迭代都能沿着统一链路推进：`问题定义 -> 规格说明 -> 技术设计 -> 任务拆解 -> 实现 -> 验收 -> 决策沉淀`。

## 阅读顺序

新成员或开始新迭代时，建议按以下顺序阅读：

1. [产品愿景](./product/vision.md)
2. [路线图](./product/roadmap.md)
3. [MVP 审计](./product/mvp-audit.md)
4. [编辑器领域模型](./domain/editor-model.md)
5. [开发流程](./process/dev-workflow.md)
6. 最近一个功能包下的 `spec.md / design.md / tasks.md`
7. 相关 [ADR](./adr/)

## 目录说明

- `product/`
  - 产品层文档，定义目标、阶段边界和版本演进。
- `domain/`
  - 领域知识沉淀，统一术语和核心模型。
- `specs/`
  - 每个功能一个目录，默认包含 `spec.md`、`design.md`、`tasks.md`。
- `adr/`
  - 长期有效的关键技术决策记录。
- `process/`
  - 研发流程、门禁规则和完成定义。
- `templates/`
  - 创建新功能或新 ADR 时使用的模板。

## SDD 基本规则

- 没有 `spec.md`，不开始功能开发。
- 涉及公共能力、状态结构、导出链路或编辑器内核行为变化时，没有 `design.md` 不开工。
- `tasks.md` 必须包含可执行任务和验收项，且任务状态以它为准。
- 功能实现过程中如果方案发生变化，先更新文档，再继续实现。
- 重要设计决策只要会影响后续迭代，就必须沉淀到 `design.md` 或 `adr/` 中。

## 当前起步文档

当前仓库已建立首批基础文档：

- [产品愿景](./product/vision.md)
- [路线图](./product/roadmap.md)
- [MVP 审计](./product/mvp-audit.md)
- [编辑器领域模型](./domain/editor-model.md)
- [开发流程](./process/dev-workflow.md)
- [ADR-0001: 编辑器内核选型](./adr/0001-editor-core.md)
- [Editor MVP Spec](./specs/2026-05-editor-mvp/spec.md)
- [Editor MVP Design](./specs/2026-05-editor-mvp/design.md)
- [Editor MVP Tasks](./specs/2026-05-editor-mvp/tasks.md)
