export const aiConfig = {
  baseURL: "",
  apiKey: "",
  model: "stable-diffusion-xl",
  timeoutMs: 60_000
};

export function hasAiConfig(): boolean {
  return aiConfig.baseURL && aiConfig.apiKey && aiConfig.model;
}
