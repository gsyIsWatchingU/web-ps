# 局部重绘功能修改计划

## 需求分析

用户提出了两个修改需求：

1. **点击局部重绘后默认选中画笔**：当用户点击左侧工具栏的"局部重绘"工具时，应该自动选中画笔模式，允许用户直接在图片上绘制要局部调整的区域。

2. **额外引导改成提示词**：将右侧面板中"额外引导"的标签改为"提示词"，并将输入框中的默认内容（placeholder）改成中文。

## 代码分析

### 需求1分析

从代码分析来看，`startRepairSession` 函数（在 `useEditorStore.ts` 第1465行）已经默认设置 `toolMode: "brush"`，所以点击局部重绘后默认选中画笔的功能**已经实现**。

需要确认的是：当用户切换到repair工具时，是否能正确触发绘制功能。

### 需求2分析

在 `EditorWorkspace.tsx` 第1052-1059行，有以下代码：
```tsx
<label className="workspace__property">
  <span className="workspace__property-label">额外引导</span>
  <textarea
    className="workspace__text-area"
    onChange={(event) => updateRepairPrompt(selectedImageLayer.id, event.target.value)}
    placeholder="可选：描述需要保护的内容或修复区域的融合方式。"
    rows={4}
    value={selectedImageLayer.aiMeta.repairPrompt}
  />
</label>
```

需要修改：
- 将"额外引导"改为"提示词"
- 将placeholder改为更合适的中文提示

## 修改方案

### 修改文件

1. `src/features/editor/components/EditorWorkspace.tsx`
   - 第1052行：将"额外引导"改为"提示词"
   - 第1056行：修改placeholder为中文提示词

## 具体步骤

1. 读取 EditorWorkspace.tsx 文件中第1050-1060行的内容
2. 修改标签文本从"额外引导"改为"提示词"
3. 修改placeholder文本为更清晰的中文提示

## 风险评估

- 低风险：仅修改UI文本，不影响核心逻辑
- 无需测试：纯文本修改，不会引入功能bug