
# 局部重绘工具属性面板样式修复计划

## 问题描述
局部重绘工具被选中时，右侧边栏的工具属性面板样式与其他工具不一致，主要问题是：
- 使用了未定义样式的 `workspace__mask-mode-panel` 类名
- 按钮没有使用标准的 `workspace__action-button` 类名
- 缺少标准的 `workspace__property-label` 标签

## 修复方案
修改 `src/features/editor/components/EditorWorkspace.tsx` 文件中局部重绘工具的属性面板代码，将自定义的模式选择面板改为标准的工具属性结构。

### 修改内容
将第 1010-1035 行的代码：
```jsx
<div className="workspace__mask-mode-panel">
  <span>选择模式</span>
  <button
    className={activeRepairSession?.toolMode !== "eraser" ? "is-active" : ""}
    onClick={() => setRepairToolMode("brush")}
    type="button"
  >
    画笔
  </button>
  <button
    className={activeRepairSession?.toolMode === "eraser" ? "is-active" : ""}
    onClick={() => setRepairToolMode("eraser")}
    type="button"
  >
    橡皮擦
  </button>
  <button
    className={activeRepairSession?.guidePreviewEnabled !== false ? "is-active" : ""}
    onClick={() =>
      setRepairGuidePreviewEnabled(!(activeRepairSession?.guidePreviewEnabled !== false))
    }
    type="button"
  >
    预览引导
  </button>
</div>
```

修改为：
```jsx
<div className="workspace__property">
  <div className="workspace__property-label">选择模式</div>
  <div className="workspace__inline-actions">
    <button
      className={`workspace__action-button ${activeRepairSession?.toolMode !== "eraser" ? "is-active" : ""}`}
      onClick={() => setRepairToolMode("brush")}
      type="button"
    >
      画笔
    </button>
    <button
      className={`workspace__action-button ${activeRepairSession?.toolMode === "eraser" ? "is-active" : ""}`}
      onClick={() => setRepairToolMode("eraser")}
      type="button"
    >
      橡皮擦
    </button>
    <button
      className={`workspace__action-button ${activeRepairSession?.guidePreviewEnabled !== false ? "is-active" : ""}`}
      onClick={() =>
        setRepairGuidePreviewEnabled(!(activeRepairSession?.guidePreviewEnabled !== false))
      }
      type="button"
    >
      预览引导
    </button>
  </div>
</div>
```

## 影响范围
- 仅影响局部重绘工具的属性面板样式
- 修改后将与其他工具（如滤镜、裁剪等）的属性面板样式保持一致

## 验证方式
1. 运行项目，选择局部重绘工具
2. 查看右侧边栏的工具属性面板，确认样式与其他工具一致
3. 测试按钮功能正常（画笔/橡皮擦切换、预览引导切换）
