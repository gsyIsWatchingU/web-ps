# 禁用浏览器缩放功能的实现方案

## 问题分析

用户反馈无法在视口中拖动元素、改变元素的宽高，也无法对焦点进行缩放（Ctrl+鼠标滚轮）。问题根源在于：

1. 浏览器默认的缩放行为（Ctrl+滚轮）会缩放整个页面，干扰编辑器画布的正常操作
2. 当前 `CanvasViewport.tsx` 中已实现画布区域的缩放处理，但浏览器级别的缩放仍然会被触发

## 解决方案

在全局层面禁用浏览器的缩放行为，只允许画布区域的自定义缩放功能。

### 修改文件

1. **src/styles/global.css** - 添加全局 CSS 属性禁用浏览器缩放
2. **src/app/App.tsx** - 添加全局事件监听器，阻止浏览器默认缩放行为

### 实施步骤

1. 在 `global.css` 中添加 CSS 属性禁用文本缩放
2. 在 `App.tsx` 中添加 `wheel` 事件监听器，当检测到 Ctrl+滚轮组合时阻止默认行为
3. 确保画布区域的缩放仍然正常工作

## 修改方案

### 1. 修改 global.css

```css
html {
  touch-action: none;
  touch-action: pan-x pan-y;
}
```

### 2. 修改 App.tsx

添加全局 wheel 事件监听器：

```typescript
useEffect(() => {
  const handleWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  };

  window.addEventListener('wheel', handleWheel, { passive: false });
  return () => {
    window.removeEventListener('wheel', handleWheel);
  };
}, []);
```

### 3. CanvasViewport.tsx 中的缩放处理

当前已有的 `handleMouseWheel` 处理已经正确工作，需要确保它能继续正常运行：

```typescript
const handleMouseWheel = (event: { e: WheelEvent }) => {
  if (!event.e.ctrlKey) {
    return;
  }
  event.e.preventDefault();
  // ... 画布缩放逻辑
};
```

## 预期效果

1. 浏览器默认的 Ctrl+滚轮缩放被禁用
2. 画布区域的缩放功能正常工作
3. 页面上其他元素不受影响

## 风险评估

* 低风险：只是阻止浏览器默认行为，不会影响现有功能

* 需要确保画布缩放仍然正常工作

## 测试验证

1. 在画布区域使用 Ctrl+滚轮，验证画布缩放正常
2. 在页面其他区域使用 Ctrl+滚轮，验证浏览器缩放被禁用
3. 验证拖动、改变元素宽高等操作正常

