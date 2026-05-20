export const aiConfig = {
  baseURL: import.meta.env.VITE_AI_BASE_URL || "",
  apiKey: import.meta.env.VITE_AI_API_KEY || "",
  model: import.meta.env.VITE_AI_MODEL || "doubao-seed3d-2-0-260328",
  repairModel: import.meta.env.VITE_AI_REPAIR_MODEL || import.meta.env.VITE_AI_MODEL || "",
  timeoutMs: Number(import.meta.env.VITE_AI_TIMEOUT_MS) || 120_000
};

export function hasAiConfig(): boolean {
  return Boolean(aiConfig.baseURL && aiConfig.apiKey && aiConfig.model);
}
