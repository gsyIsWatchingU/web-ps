# 调整计划：移除右侧边栏的水平滚动条

## 问题分析
之前的修改对 `.workspace__column` 和 `.workspace__panel` 都应用了 `overflow: visible`，导致：
1. 右侧边栏可能出现水平滚动条
2. 需要只对左侧工具列允许 tooltip 溢出，右侧边栏保持原有行为

## 解决方案
修改 `src/styles/global.css`：
1. 将 `.workspace__panel` 的 `overflow: visible` 改回 `overflow: auto`
2. 确保 `.workspace__panel-content` 水平方向为 `hidden` 或不产生滚动条
3. 左侧工具列 `.workspace__column` 保持允许溢出

## 具体修改
文件：`src/styles/global.css`

1. **第 178-185 行**：将 `.workspace__column, .workspace__panel` 的 `overflow: visible` 改为分开设置：
   - `.workspace__column`: `overflow: visible`（允许 tooltip 溢出）
   - `.workspace__panel`: `overflow: auto`（保持原有滚动行为）

2. **第 202-210 行**：将 `.workspace__panel-content` 的 `overflow: visible auto` 改为 `overflow: auto hidden`，确保右侧内容不产生水平滚动条

## 预期效果
- 左侧工具列的 tooltip 仍能正确溢出显示
- 右侧边栏不再出现水平滚动条
