export const aiConfig = {
  baseURL: "https://YOUR_OPENAI_COMPATIBLE_BASE_URL",
  apiKey: "YOUR_API_KEY_HERE",
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
