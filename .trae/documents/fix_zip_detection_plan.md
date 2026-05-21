# 修复 ZIP 文件检测问题

## 问题分析

错误信息 `Unexpected token 'P', "PK"... is not valid JSON` 表明：
1. 文件已成功下载（是 ZIP 文件，`PK` 是 ZIP 格式的魔数）
2. 但 `isZipUrl()` 函数只检查 URL 是否以 `.zip` 结尾
3. 如果 URL 没有 `.zip` 扩展名，ZIP 解压逻辑不会被触发
4. GLTFLoader 尝试直接解析 ZIP 文件作为 JSON，导致失败

## 修复方案

### 修改 GLBModelViewer.tsx
1. 添加 `isZipContent()` 函数检测文件内容是否是 ZIP 格式（检查魔数）
2. 修改逻辑，同时检查 URL 扩展名和文件内容
3. 如果是 ZIP 文件，先解压再加载模型

## 修改文件
- `src/features/editor/components/GLBModelViewer.tsx`

## 实现步骤
1. 添加 ZIP 内容检测函数
2. 修改加载逻辑，同时检查 URL 和内容
3. 构建测试

## 技术细节

ZIP 文件的魔数（Magic Number）是字节 `0x50 0x4B 0x03 0x04`，即 ASCII 字符 `PK`。

```typescript
function isZipContent(arrayBuffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(arrayBuffer);
  return bytes.length >= 4 && 
         bytes[0] === 0x50 && 
         bytes[1] === 0x4B && 
         bytes[2] === 0x03 && 
         bytes[3] === 0x04;
}
```
