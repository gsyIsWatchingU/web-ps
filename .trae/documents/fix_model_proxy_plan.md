# 修复模型代理配置问题

## 问题分析

错误 `Unexpected token '<', "<!doctype"...` 表明代理没有正常工作，仍然在获取 HTML 页面。这是因为：

1. Vite 的 `middleware` 配置选项不正确，应该使用 `configureServer` API
2. 需要正确配置 Vite 插件来拦截请求

## 修复方案

### 1. 修复 vite.config.ts
- 改为使用 `configureServer` API
- 创建一个 Vite 插件来实现代理功能

### 2. 增强 GLBModelViewer.tsx 的调试
- 添加更多调试日志
- 在获取响应后检查内容类型
- 如果是 HTML，显示更友好的错误信息

### 3. 验证修复
- 重启开发服务器
- 检查控制台日志
- 测试模型加载

## 修改文件
- `vite.config.ts`
- `src/features/editor/components/GLBModelViewer.tsx`

## 实现步骤
1. 重写 vite.config.ts，使用正确的 configureServer API
2. 增强 GLBModelViewer.tsx 的错误处理和调试
3. 构建并测试
