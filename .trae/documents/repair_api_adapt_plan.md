# 局部重绘工具API适配计划

## 一、需求分析

用户提供了新的火山引擎图像生成API格式，支持多图输入（image数组），需要将现有的局部重绘工具适配到新API。

### 现有API调用方式

当前在 `imageEditBridge.ts` 中使用 `/image-edits` 端点：

```typescript
{
  model: providerModel,
  prompt: prompt.trim(),
  image: imageDataUrl,
  mask: maskDataUrl
}
```

### 新API格式（用户提供）

**单图模式：**
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer $ARK_API_KEY" \
   -d '{
     "model": "doubao-seedream-5-0-260128",
     "prompt": "生成狗狗趴在草地上的近景画面",
     "image": "https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imageToimage.png",
     "sequential_image_generation": "disabled",
     "response_format": "url",
     "size": "2K",
     "stream": false,
     "watermark": true
 }'
```

**多图模式（适用于局部重绘）：**
```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/images/generations \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer $ARK_API_KEY" \
   -d '{
     "model": "doubao-seedream-5-0-260128",
     "prompt": "将图1的服装换为图2的服装",
     "image": ["https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imagesToimage_1.png", "https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imagesToimage_2.png"],
     "sequential_image_generation": "disabled",
     "response_format": "url",
     "size": "2K",
     "stream": false,
     "watermark": true
 }'
```

## 二、当前局部重绘工具功能分析

### 核心功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 画笔圈选 | ✅ 已完成 | 用户可使用画笔在画布上标记需要重绘的区域 |
| 橡皮擦功能 | ✅ 已完成 | 可擦除误圈选的区域 |
| 预览引导 | ✅ 已完成 | 显示圈选区域的高亮预览 |
| 画笔大小调节 | ✅ 已完成 | 支持6-120px的画笔大小 |
| 额外引导提示 | ✅ 已完成 | 用户可输入额外的修复引导词 |
| AI调用 | ✅ 已完成 | 调用后端API执行重绘 |
| 结果替换 | ✅ 已完成 | 成功后自动替换原图片 |

### 数据流程

```
用户圈选区域
    ↓
生成原图裁剪 (imageDataUrl)
生成蒙版图 (maskDataUrl)
生成引导图 (guideDataUrl) - 原图+红色高亮标记
    ↓
调用AI API
    ↓
解析返回结果
    ↓
替换原图片
```

### 核心代码文件

| 文件 | 功能 |
|------|------|
| `src/features/editor/runtime/imageEditBridge.ts` | AI桥接层，处理API调用 |
| `src/features/editor/runtime/aiConfig.ts` | AI配置管理 |
| `src/features/editor/store/useEditorStore.ts` | 状态管理 |
| `src/features/editor/components/EditorWorkspace.tsx` | 工具面板UI |
| `src/features/editor/components/CanvasViewport.tsx` | 画布交互 |

## 三、修改方案

### 1. 更新API端点配置

修改 `imageEditBridge.ts`：

```typescript
function getImageGenerationEndpoint() {
  const base = getApiBase();
  if (base === "/api/ai") {
    return `${base}/images/generations`;
  }
  return `${base}/api/v3/images/generations`;
}
```

### 2. 修改请求体格式

对于局部重绘，使用多图模式：
- `image[0]`: 原图裁剪
- `image[1]`: 引导图（带高亮标记）

```typescript
{
  model: "doubao-seedream-5-0-260128",
  prompt: "修复提示词",
  image: [imageDataUrl, guideDataUrl],
  sequential_image_generation: "disabled",
  response_format: "url",
  size: "2K",
  stream: false,
  watermark: true
}
```

### 3. 配置更新

在 `aiConfig.ts` 中添加新配置项：

```typescript
export const aiConfig = {
  baseURL: import.meta.env.VITE_AI_BASE_URL || "",
  apiKey: import.meta.env.VITE_AI_API_KEY || "",
  model: import.meta.env.VITE_AI_MODEL || "doubao-seed3d-2-0-260328",
  repairModel: import.meta.env.VITE_AI_REPAIR_MODEL || "doubao-seedream-5-0-260128",
  timeoutMs: Number(import.meta.env.VITE_AI_TIMEOUT_MS) || 120_000
};
```

### 4. 修改API调用逻辑

更新 `runInpaintingTask` 函数以使用新API格式：

```typescript
async function runInpaintingTask({
  imageDataUrl,
  maskDataUrl,
  guideDataUrl,
  prompt,
  model
}: ImageRepairTaskInput): Promise<ImageRepairTaskResult> {
  const providerModel = model || aiConfig.repairModel || aiConfig.model;
  
  // 使用多图模式：原图 + 引导图
  const images = [imageDataUrl];
  if (guideDataUrl) {
    images.push(guideDataUrl);
  }
  
  const response = await fetch(getImageGenerationEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiConfig.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: providerModel,
      prompt: prompt.trim(),
      image: images,
      sequential_image_generation: "disabled",
      response_format: "url",
      size: "2K",
      stream: false,
      watermark: true
    })
  });
  
  // ... 后续处理逻辑保持不变
}
```

## 四、文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/features/editor/runtime/imageEditBridge.ts` | 更新API端点和请求体格式，适配多图输入 |
| `src/features/editor/runtime/aiConfig.ts` | 添加repairModel默认值 |

## 五、风险评估

| 风险 | 说明 | 应对措施 |
|------|------|----------|
| API兼容性 | 新API参数格式变更 | 按照用户提供的示例调整请求体 |
| 多图顺序 | image数组顺序是否有要求 | 按原图在前、引导图在后的顺序传递 |
| 响应格式 | 响应结构是否变化 | 保留现有的响应解析逻辑，支持多种返回格式 |
| 模型支持 | doubao-seedream是否支持局部重绘 | 需要确认模型能力 |

## 六、验证计划

1. 配置正确的API Key和端点
2. 在编辑器中导入图片
3. 使用局部重绘工具圈选区域
4. 点击"执行重绘"按钮
5. 验证返回结果是否正确替换图片

## 七、实施步骤

1. 修改 `aiConfig.ts` 更新repairModel默认值
2. 修改 `imageEditBridge.ts` 更新API端点和请求格式
3. 更新 `.env` 文件添加环境变量（如需要）
4. 测试功能是否正常工作