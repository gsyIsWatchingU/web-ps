# 画布视口约束与工作区滚动修正

## Summary

调整编辑器画布视口行为，确保画布始终留在编辑区可视范围内，默认进入时采用更合适的纵向偏移，并移除工作区的水平滚动条。

## Key Changes

- 在 [src/features/editor/components/CanvasViewport.tsx](E:/new-study/web-ps/src/features/editor/components/CanvasViewport.tsx) 新增统一的视口约束逻辑：
  - 基于 `viewportBounds`、画布尺寸、当前 `zoom` 计算允许的 `panX/panY` 范围。
  - 约束规则应用到三处：默认自动视口、手动拖拽平移、按 `Ctrl/Cmd + 滚轮` 缩放后的新视口。
  - 默认自动视口不再使用当前“完全居中”的 `panY`，改为优先让画布顶部距编辑区约 `70px`；若该偏移会导致画布超出允许范围，则再按边界规则夹紧。
- 保持现有 `zoom` 计算方式不变，只调整 `pan` 的生成和落地：
  - 初始自动视口仍按容器尺寸算适配缩放。
  - `panX` 不允许再把画布拖到编辑区外侧。
  - `panY` 默认采用更靠上的视觉位置，但后续仍受同一套边界限制。
- 在 [src/styles/global.css](E:/new-study/web-ps/src/styles/global.css) 收紧工作区滚动策略：
  - `.workspace__viewport-shell` 改为禁止横向滚动，只保留必要的纵向滚动能力或直接隐藏横向溢出。
  - 如有需要，同步检查 `.workspace__viewport-inner` / `.workspace__viewport-board` 的最小宽度与对齐方式，避免内部布局反向撑出横向滚动条。

## Public Interfaces / Data

- 不新增 store API，也不修改 `CanvasViewport` 数据结构。
- `document.canvas.viewport` 仍保持 `{ zoom, panX, panY }` 形状，只改变其计算与约束策略。
- `LEGACY_DEFAULT_CANVAS_VIEWPORT` 和 schema 可保持不变；“默认纵坐标 70”应落在自动视口计算层，而不是写死到文档默认值中。

## Test Plan

- 初次进入编辑器时，画布顶部在编辑区内，视觉上纵向偏移接近 `70px`，不会再出现类似 `panY=-94` 这类默认越界。
- 不同画布比例下验证默认视口：
  - 宽图场景不再出现类似 `panX=-120 / panY=76` 的左侧越界。
  - 高图场景不再出现类似 `panX=395 / panY=-94` 的顶部越界。
- 拖拽平移时，向四个方向拖到边界后会被夹住，画布不能继续拖出编辑区。
- `Ctrl/Cmd + 滚轮` 缩放后，焦点缩放仍正常，且缩放结束时画布不会被推到编辑区外。
- 工作区在常见桌面宽度下不再出现水平滚动条；纵向内容过长时右侧面板与页面纵向滚动不受影响。

## Assumptions

- “不允许画布超出编辑区”按已确认的方案执行为“始终限制”，不是只修默认值。
- “默认的竖直坐标为 70”解释为自动进入/重置视口时，画布顶部相对编辑区保留约 `70px` 的视觉起始偏移。
- “工作区不需要水平滚动条”解释为中间画布工作区禁止横向滚动，不影响页面或侧栏在纵向上的正常滚动。

