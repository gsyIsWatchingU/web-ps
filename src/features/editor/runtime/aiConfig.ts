// export const aiConfig = {
//   baseURL: "https://openrouter.ai/api/v1",
//   apiKey: "sk-d938f4129b2a4704ba1240558be6e51f",
//   model: "qwen3.5-omni-plus-2026-03-15",
//   timeoutMs: 90000
// } as const;
export const aiConfig = {
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "sk-d938f4129b2a4704ba1240558be6e51f",
  model: "wanx2.1-imageedit",
  timeoutMs: 90000
} as const;

export function hasAiConfig() {
  return ![
    aiConfig.baseURL,
    aiConfig.apiKey,
    aiConfig.model
  ].some((value) => value.includes("YOUR_"));
}
