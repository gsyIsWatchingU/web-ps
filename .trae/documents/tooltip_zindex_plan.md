## 修改计划：工具悬停说明文字层级优化

### 问题分析
工具悬停时出现的说明文字（tooltip）被右侧容器遮挡，原因是：
1. `.workspace__column`（左侧工具列）设置了 `overflow: hidden`
2. `.workspace__section`（工具区域）也设置了 `overflow: hidden`
3. 虽然 tooltip 本身设置了 `z-index: 240`，但由于父容器的 `overflow: hidden`，tooltip 被裁剪了

### 修改方案
修改 `src/styles/global.css` 文件，调整以下样式：

1. 将 `.workspace__column` 的 `overflow: hidden` 改为 `overflow-x: hidden; overflow-y: auto`，允许水平方向溢出
2. 将 `.workspace__section` 的 `overflow: visible` 保留并确保生效
3. 确保 `.workspace__tool-stack` 的 `overflow: visible` 正确设置

### 修改文件
- `src/styles/global.css`

### 具体修改点
1. 第 179-186 行：修改 `.workspace__column` 的 overflow 属性
2. 第 214-222 行：确保 `.workspace__section` 的 overflow 为 visible
3. 第 530-532 行：确保 `.workspace__tool-stack` 的 overflow 为 visible

### 预期效果
修改后，工具按钮悬停时的说明文字（tooltip）将能够浮于最上层，不会被右侧容器遮挡。