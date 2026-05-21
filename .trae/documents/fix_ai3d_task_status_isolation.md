# 立体创作任务状态独立修复计划

## 问题分析

当前代码使用全局的 `aiBusy` 状态来控制立体创作按钮的禁用和显示文本：

1. **问题位置**：`src/features/editor/components/EditorWorkspace.tsx`
   - 第364行定义了全局状态 `const [aiBusy, setAiBusy] = useState<"repair" | "ai3d" | null>(null)`
   - 第1186行按钮禁用条件：`disabled={aiBusy !== null || !aiConfigured || !canGenerate}`
   - 第1190行按钮文本：`{aiBusy === "ai3d" ? "创作中..." : "开始立体创作"}`

2. **根本原因**：
   - 当对某张图片发起立体创作时，`handleAi3d` 调用 `setAiBusy("ai3d")` 设置全局状态
   - 切换到其他图片图层时，全局状态仍然有效，导致所有图片按钮都显示"创作中..."

3. **解决方案**：
   - 移除对全局 `aiBusy` 状态的依赖
   - 使用当前选中图层的 `model3dTask.status` 来判断是否正在进行立体创作
   - 每个图层都有独立的 `model3dTask` 状态，已存储在 `ImageAiMeta.model3dTask` 中

## 修改方案

### 1. 修改 EditorWorkspace.tsx

**修改按钮禁用条件和显示文本逻辑**：
- 将 `aiBusy !== null` 改为检查当前图层的 `model3dTask.status` 是否为 `pending` 或 `running`
- 将 `aiBusy === "ai3d"` 判断改为检查 `model3dTask.status` 是否为 `pending` 或 `running`

### 2. 保留 `aiBusy` 状态用于局部重绘

局部重绘功能仍然需要 `aiBusy === "repair"` 的判断，因此需要保留 `aiBusy` 状态但仅用于局部重绘。

## 具体修改

### 文件：src/features/editor/components/EditorWorkspace.tsx

**修改位置1：第1186行（按钮禁用条件）**
```tsx
// 修改前
disabled={aiBusy !== null || !aiConfigured || !canGenerate}

// 修改后 - 仅检查当前图层的任务状态
disabled={(task.status === "pending" || task.status === "running") || !aiConfigured || !canGenerate}
```

**修改位置2：第1190行（按钮文本）**
```tsx
// 修改前
{aiBusy === "ai3d" ? "创作中..." : "开始立体创作"}

// 修改后 - 根据当前图层任务状态显示
{(task.status === "pending" || task.status === "running") ? "创作中..." : "开始立体创作"}
```

**修改位置3：第1193行（状态提示条件）**
```tsx
// 修改前
{task.status === "pending" && aiBusy === "ai3d" ? (

// 修改后 - 移除对 aiBusy 的依赖
{task.status === "pending" ? (
```

**保留的代码**：`handleAi3d` 函数中的 `setAiBusy("ai3d")` 和 `setAiBusy(null)` 可以保留或移除，因为不再使用。建议移除以清理代码。

## 风险评估

- **低风险**：修改仅涉及 UI 层的状态判断逻辑
- **向后兼容**：不影响数据模型和 API 调用
- **测试要点**：
  1. 选中图片A发起立体创作，按钮显示"创作中..."
  2. 切换到图片B，按钮应显示"开始立体创作"
  3. 图片A完成后，切换回图片A，按钮显示"开始立体创作"

## 验证步骤

1. 启动开发服务器
2. 创建多个图片图层
3. 对其中一张图片发起立体创作
4. 切换到其他图片图层，确认按钮状态独立