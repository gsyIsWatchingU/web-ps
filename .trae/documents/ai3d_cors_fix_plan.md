# 调整 AI3D 模型预览 CORS 问题

## 问题分析

模型文件托管在火山引擎存储服务上（`ark-content-generation-cn-beijing.tos-cn-beijing.volces.com`），该服务器未返回 `Access-Control-Allow-Origin` 头，导致浏览器跨域请求被阻止。

## 解决方案

通过 Vite 开发服务器中间件代理模型文件请求，将外部 URL 的请求转发到目标服务器，从而避免浏览器 CORS 限制。

## 修改文件

### 1. 修改 vite.config.ts
添加一个中间件来代理模型文件请求：

- 添加 `/api/model-proxy` 端点
- 接收 `url` 查询参数
- 使用 `node-fetch` 或内置 `fetch` 获取目标资源
- 返回资源内容并添加适当的 CORS 头

### 2. 修改 GLBModelViewer.tsx
修改模型加载逻辑：

- 将模型 URL 改为通过代理获取
- 使用 fetch 获取模型文件到 ArrayBuffer
- 使用 `URL.createObjectURL` 创建本地 Blob URL
- 将 Blob URL 传递给 GLTFLoader
- 组件卸载时清理 Blob URL

## 实现步骤

| 序号 | 任务 | 描述 |
|:---|:---|:---|
| 1 | 修改 vite.config.ts | 添加模型代理中间件 |
| 2 | 修改 GLBModelViewer.tsx | 使用 fetch + Blob 方式加载模型 |
| 3 | 测试构建 | 验证修改无编译错误 |

## 技术细节

### Vite 中间件实现
```typescript
server.middlewares.use('/api/model-proxy', async (req, res) => {
  const targetUrl = req.query.url as string;
  // fetch 并返回，带 CORS 头
});
```

### GLBModelViewer 修改
```typescript
// 使用 fetch 获取模型到 ArrayBuffer
const response = await fetch(`/api/model-proxy?url=${encodeURIComponent(modelUrl)}`);
const buffer = await response.arrayBuffer();
const blob = new Blob([buffer], { type: 'model/gltf-binary' });
const blobUrl = URL.createObjectURL(blob);
// 使用 blobUrl 加载模型
```

## 风险与注意事项

- 代理只用于开发环境（Vite dev server）
- 生产环境需要后端服务器支持或使用支持 CORS 的存储
- 模型文件可能较大，需要处理加载进度
- 代理请求可能会增加加载时间
