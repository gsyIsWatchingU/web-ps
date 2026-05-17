export const aiConfig = {
  baseURL: "https://api-inference.modelscope.cn",
  apiKey: "ms-ad11675a-84c2-40d2-abbf-e33059c38b8e",
  model: "YOUR_IMAGE_MODEL_HERE",
  timeoutMs: 90000
} as const;

export function hasAiConfig() {
  return ![
    aiConfig.baseURL,
    aiConfig.apiKey,
    aiConfig.model
  ].some((value) => value.includes("YOUR_"));
}
