# 局部重绘右侧边栏英文转中文修改计划

## 问题描述
用户反馈：当选中"局部重绘"工具时，右侧边栏的内容变成了英文，需要改为中文。

## 问题位置
文件：`src/features/editor/components/EditorWorkspace.tsx`
行号：1000-1097 行

## 需要修改的英文文本

| 行号 | 英文原文 | 中文翻译 |
|------|----------|----------|
| 1007 | AI is not configured... | AI 配置未完成，请检查环境变量... |
| 1011 | Selection Mode | 选择模式 |
| 1017 | Brush | 画笔 |
| 1024 | Eraser | 橡皮擦 |
| 1033 | Guide Preview | 预览引导 |
| 1037 | Brush Size | 画笔大小 |
| 1050 | Extra Guidance | 额外引导 |
| 1054 | Optional: describe what to protect... | 可选：描述需要保护的内容或修复区域的融合方式 |
| 1066 | Undo Stroke | 撤销描边 |
| 1074 | Clear Selection | 清除选区 |
| 1082 | Repainting... / Run Repair | 重绘中... / 执行重绘 |
| 1086 | The editor automatically turns... | 编辑器会自动将绘制区域转换为高亮引导图... |
| 1090 | Repair status: | 重绘状态： |

## 修改步骤
1. 读取 `EditorWorkspace.tsx` 文件确认最新内容
2. 将所有英文文本替换为中文
3. 验证修改是否正确

## 风险评估
- 低风险：仅修改文本内容，不涉及逻辑变更
- 需要注意保持代码结构和变量引用不变

## 预期结果
修改后，选中"局部重绘"工具时，右侧边栏显示全中文内容。