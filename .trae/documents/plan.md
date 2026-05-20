# 计划：移除工具入口文字按钮并扩展花字样式

## 任务概述
1. 去掉工具入口的文字按钮（因为画布上方已有"添加文字"按钮）
2. 把"添加文字"改成"添加花字"，并增加更多电商背景样式

## 当前状态分析

### 1. 工具入口文字按钮
- **文件**: [EditorWorkspace.tsx](file:///e:/new-study/web-ps/src/features/editor/components/EditorWorkspace.tsx#L52)
- **代码**: `{ id: "text", label: "文字", hint: "添加标题、价格和卖点文案", icon: "T" }`
- **渲染位置**: 第1943行 `toolItemsAntd.filter((tool) => tool.id !== "hand" && tool.id !== "shape")`

### 2. 画布上方添加文字按钮
- **文件**: [EditorWorkspace.tsx](file:///e:/new-study/web-ps/src/features/editor/components/EditorWorkspace.tsx#L1964-L1966)
- **代码**: `<button ... onClick={addTextLayer}>添加文字</button>`

### 3. 现有文字模板样式 (textTemplatePresets)
- **文件**: [document.ts](file:///e:/new-study/web-ps/src/features/editor/model/document.ts#L261-L331)
- **现有4种样式**:
  1. `title` - 标题大字
  2. `price` - 价格贴片
  3. `coupon` - 优惠券文案
  4. `highlight` - 重点高亮条

## Proposed Changes

### 1. 移除工具入口文字按钮
**文件**: `src/features/editor/components/EditorWorkspace.tsx`
**位置**: 第1943行

**修改内容**:
```diff
- {toolItemsAntd.filter((tool) => tool.id !== "hand" && tool.id !== "shape").map((tool) => (
+ {toolItemsAntd.filter((tool) => tool.id !== "hand" && tool.id !== "shape" && tool.id !== "text").map((tool) => (
```

### 2. 删除工具入口定义中的文字按钮
**文件**: `src/features/editor/components/EditorWorkspace.tsx`
**位置**: 第52行

**修改内容**: 删除 `{ id: "text", label: "文字", hint: "添加标题、价格和卖点文案", icon: "T" },`

### 3. 修改画布上方按钮文字
**文件**: `src/features/editor/components/EditorWorkspace.tsx`
**位置**: 第1964-1966行

**修改内容**:
```diff
- <button className="workspace__tool-button" onClick={addTextLayer} type="button">
-   添加文字
- </button>
+ <button className="workspace__tool-button" onClick={addTextLayer} type="button">
+   添加花字
+ </button>
```

### 4. 扩展花字样式（新增电商背景样式）
**文件**: `src/features/editor/model/document.ts`
**位置**: 第261-331行的 `textTemplatePresets` 数组

**新增6种电商花字样式**:

```javascript
{
  id: "flash",
  label: "秒杀闪购",
  content: "限时秒杀",
  name: "秒杀闪购",
  style: {
    fontSize: 64,
    fontWeight: 800,
    fill: "#ffffff",
    stroke: "#d00f00",
    strokeWidth: 5,
    shadow: "0 16px 32px rgba(208, 15, 0, 0.3)",
    backgroundColor: "#ff4d4d",
    gradient: ["#ff8080", "#ff0000"]
  }
},
{
  id: "new",
  label: "新品推荐",
  content: "新品上市",
  name: "新品推荐",
  style: {
    fontSize: 60,
    fontWeight: 800,
    fill: "#ffffff",
    stroke: "#1a5f4a",
    strokeWidth: 4,
    shadow: "0 14px 28px rgba(26, 95, 74, 0.2)",
    backgroundColor: "#00c875",
    gradient: ["#50ffb3", "#00c875"]
  }
},
{
  id: "hot",
  label: "热销爆款",
  content: "热销爆款",
  name: "热销爆款",
  style: {
    fontSize: 66,
    fontWeight: 800,
    fill: "#fff5e6",
    stroke: "#8b4500",
    strokeWidth: 6,
    shadow: "0 18px 30px rgba(139, 69, 0, 0.25)",
    backgroundColor: "#ff9d4d",
    gradient: ["#ffcc80", "#ff6600"]
  }
},
{
  id: "free",
  label: "包邮特惠",
  content: "全场包邮",
  name: "包邮特惠",
  style: {
    fontSize: 56,
    fontWeight: 700,
    fill: "#ffffff",
    stroke: "#2d5f8b",
    strokeWidth: 4,
    shadow: "0 14px 26px rgba(45, 95, 139, 0.2)",
    backgroundColor: "#5dade2",
    gradient: ["#85c1e9", "#3498db"]
  }
},
{
  id: "gift",
  label: "赠品专属",
  content: "满赠好礼",
  name: "赠品专属",
  style: {
    fontSize: 52,
    fontWeight: 700,
    fill: "#fff0f5",
    stroke: "#8b1455",
    strokeWidth: 4,
    shadow: "0 14px 26px rgba(139, 20, 85, 0.2)",
    backgroundColor: "#ff85a2",
    gradient: ["#ffb6c1", "#ff69b4"]
  }
},
{
  id: "digital",
  label: "数码科技",
  content: "科技生活",
  name: "数码科技",
  style: {
    fontSize: 58,
    fontWeight: 700,
    fill: "#e6f4ff",
    stroke: "#004080",
    strokeWidth: 4,
    shadow: "0 14px 26px rgba(0, 64, 128, 0.2)",
    backgroundColor: "#4da6ff",
    gradient: ["#80bfff", "#0066cc"]
  }
}
```

## Assumptions & Decisions
1. 删除工具入口的"文字"按钮而不删除其定义，只是从渲染时过滤掉
2. 画布上方按钮文字改为"添加花字"后保持原有功能
3. 新增的6种花字样式都是针对电商场景设计
4. 新增样式的id需要唯一且不能与现有id冲突

## Verification Steps
1. 确认左侧工具栏中"文字"按钮已移除
2. 确认画布上方按钮文字已改为"添加花字"
3. 确认点击"添加花字"后弹出的模板选择中有10种样式可选
4. 运行 `npm run typecheck` 确保没有类型错误
