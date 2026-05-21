import { aiConfig, hasAiConfig } from "./aiConfig";

export type Seed3DTaskResult = {
  taskId: string | null;
  status: "pending" | "running" | "succeeded" | "failed";
  downloadUrl: string | null;
  fileName: string | null;
  providerModel: string | null;
  errorMessage: string | null;
};

type Seed3DCreateResponse = {
  request_id?: string;
  task_id?: string;
  id?: string;
  status?: string;
  code?: string;
  message?: string;
};

type Seed3DStatusResponse = {
  request_id?: string;
  id?: string;
  status?: string;
  result?: Array<{
    url?: string;
  }>;
  content?: {
    file_url?: string;
  };
  error_code?: string;
  error_message?: string;
  code?: string;
  message?: string;
  task?: {
    task_id?: string;
    status?: string;
    result?: Array<{
      url?: string;
    }>;
    content?: {
      file_url?: string;
    };
    error_code?: string;
    error_message?: string;
  };
};

function getApiBase() {
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname)) {
    return "/api/ai";
  }
  return aiConfig.baseURL.replace(/\/$/, "");
}

function getTaskCreateEndpoint() {
  const base = getApiBase();
  if (base === "/api/ai") {
    return `${base}/contents/generations/tasks`;
  }
  return `${base}/api/v3/contents/generations/tasks`;
}

function getTaskStatusEndpoint(taskId: string) {
  const base = getApiBase();
  if (base === "/api/ai") {
    return `${base}/contents/generations/tasks/${taskId}`;
  }
  return `${base}/api/v3/contents/generations/tasks/${taskId}`;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildSeed3DErrorMessage(payloadMessage: string | undefined, fallbackMessage: string) {
  const rawMessage = payloadMessage?.trim();
  const normalized = rawMessage?.toLowerCase() ?? "";

  if (normalized.includes("access denied") || normalized.includes("forbidden") || normalized.includes("quota")) {
    return `立体创作当前不可用：账号权限不足或额度超限，请检查 API Key 和账户状态。原始错误：${rawMessage}`;
  }

  if (normalized.includes("unauthorized") || normalized.includes("invalid api key") || normalized.includes("api key")) {
    return `立体创作当前不可用：API Key 无效，请检查 .env 中的 VITE_AI_API_KEY 配置。原始错误：${rawMessage}`;
  }

  if (normalized.includes("insufficient balance") || normalized.includes("余额")) {
    return "立体创作当前不可用：账户余额不足，请充值后重试。";
  }

  if (normalized.includes("timeout")) {
    return "立体创作处理超时，请稍后重试。";
  }

  if (normalized.includes("network") || normalized.includes("failed to fetch")) {
    return "立体创作请求失败：网络连接异常，暂时无法访问模型服务。";
  }

  if (rawMessage) {
    return `${fallbackMessage} 原始错误：${rawMessage}`;
  }

  return fallbackMessage;
}

function normalizeTaskStatus(providerStatus: string): Seed3DTaskResult["status"] {
  const normalized = providerStatus.toLowerCase();
  
  if (normalized.includes("succeeded") || normalized.includes("completed") || normalized.includes("success")) {
    return "succeeded";
  }
  
  if (normalized.includes("failed") || normalized.includes("error") || normalized.includes("canceled")) {
    return "failed";
  }
  
  if (normalized.includes("running") || normalized.includes("processing") || normalized.includes("generating")) {
    return "running";
  }
  
  return "pending";
}

function extractFileNameFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split("/");
    const fileName = pathParts[pathParts.length - 1];
    return fileName || "model.glb";
  } catch {
    return "model.glb";
  }
}

export async function createSeed3dTask(imageUrl: string, prompt: string): Promise<Seed3DTaskResult> {
  if (!hasAiConfig()) {
    return {
      taskId: null,
      status: "failed",
      downloadUrl: null,
      fileName: null,
      providerModel: null,
      errorMessage: "AI 配置不完整，请在 .env 中配置 VITE_AI_BASE_URL、VITE_AI_API_KEY 和 VITE_AI_MODEL。"
    };
  }

  const isBase64Image = imageUrl.startsWith("data:image/");
  
  let imageContent;
  if (isBase64Image) {
    imageContent = { type: "image_url", image_url: { url: imageUrl } };
  } else {
    imageContent = { type: "image_url", image_url: { url: imageUrl } };
  }

  try {
    const response = await fetch(getTaskCreateEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: aiConfig.model,
        content: [
          { type: "text", text: prompt?.trim() || "生成高质量3D模型。" },
          imageContent
        ],
        parameters: {
          n: 1
        }
      })
    });

    const payload = (await response.json()) as Seed3DCreateResponse;

    if (!response.ok) {
      throw new Error(
        buildSeed3DErrorMessage(
          payload.message || payload.code,
          `立体创作任务创建失败（${response.status}）。`
        )
      );
    }

    const taskId = payload.id || payload.task_id;

    if (!taskId) {
      throw new Error("立体创作任务创建成功，但没有返回任务 ID。");
    }

    return {
      taskId,
      status: "pending",
      downloadUrl: null,
      fileName: null,
      providerModel: aiConfig.model,
      errorMessage: null
    };
  } catch (error) {
    return {
      taskId: null,
      status: "failed",
      downloadUrl: null,
      fileName: null,
      providerModel: null,
      errorMessage: error instanceof Error ? error.message : "立体创作任务创建失败。"
    };
  }
}

export async function pollSeed3dTask(taskId: string): Promise<Seed3DTaskResult> {
  if (!hasAiConfig()) {
    return {
      taskId,
      status: "failed",
      downloadUrl: null,
      fileName: null,
      providerModel: null,
      errorMessage: "AI 配置不完整，请在 .env 中配置相关环境变量。"
    };
  }

  const startedAt = Date.now();
  const maxWaitTime = aiConfig.timeoutMs;

  try {
    while (Date.now() - startedAt < maxWaitTime) {
      const response = await fetch(getTaskStatusEndpoint(taskId), {
        headers: {
          Authorization: `Bearer ${aiConfig.apiKey}`,
          "Content-Type": "application/json"
        }
      });

      const payload = (await response.json()) as Seed3DStatusResponse;

      if (!response.ok) {
        throw new Error(
          buildSeed3DErrorMessage(
            payload.message || payload.code || payload.task?.error_message || payload.task?.error_code,
            `立体创作任务查询失败（${response.status}）。`
          )
        );
      }

      const providerStatus = payload.status ?? payload.task?.status ?? "";
      
      if (!providerStatus) {
        throw new Error("立体创作任务查询失败，未返回任务信息。");
      }

      const status = normalizeTaskStatus(providerStatus);
      let resultUrl = payload.result?.[0]?.url ?? payload.task?.result?.[0]?.url;
      if (!resultUrl) {
        resultUrl = payload.content?.file_url ?? payload.task?.content?.file_url;
      }
      if (resultUrl) {
        resultUrl = resultUrl.trim().replace(/^['"`]/, '').replace(/['"`]$/, '');
      }

      if (status === "succeeded") {
        
        if (!resultUrl) {
          throw new Error("立体创作任务成功，但没有返回结果文件。");
        }

        return {
          taskId,
          status: "succeeded",
          downloadUrl: resultUrl,
          fileName: extractFileNameFromUrl(resultUrl),
          providerModel: aiConfig.model,
          errorMessage: null
        };
      }

      if (status === "failed") {
        throw new Error(
          buildSeed3DErrorMessage(
            payload.error_message || payload.error_code || payload.task?.error_message || payload.task?.error_code,
            `立体创作任务失败，状态：${providerStatus}。`
          )
        );
      }

      await wait(2000);
    }

    throw new Error("立体创作处理超时，请稍后重试。");
  } catch (error) {
    return {
      taskId,
      status: "failed",
      downloadUrl: null,
      fileName: null,
      providerModel: aiConfig.model,
      errorMessage: error instanceof Error ? error.message : "立体创作任务轮询失败。"
    };
  }
}

export async function runSeed3dTask(imageUrl: string, prompt: string): Promise<Seed3DTaskResult> {
  const createResult = await createSeed3dTask(imageUrl, prompt);
  
  if (createResult.status === "failed") {
    return createResult;
  }

  if (!createResult.taskId) {
    return {
      taskId: null,
      status: "failed",
      downloadUrl: null,
      fileName: null,
      providerModel: null,
      errorMessage: "立体创作任务创建失败，未获取到任务 ID。"
    };
  }

  return pollSeed3dTask(createResult.taskId);
}
