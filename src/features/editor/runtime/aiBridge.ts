import { aiConfig, hasAiConfig } from "./aiConfig";

type AiBridgeResult = {
  success: boolean;
  imageDataUrl: string | null;
  errorMessage: string | null;
};

type AiEditInput = {
  sourceDataUrl: string;
  maskDataUrl: string;
  prompt: string;
  size: `${number}x${number}`;
};

type DashScopeTaskCreatePayload = {
  output?: {
    task_id?: string;
    task_status?: string;
  };
  code?: string;
  message?: string;
};

type DashScopeTaskResultPayload = {
  output?: {
    task_status?: string;
    code?: string;
    message?: string;
    results?: Array<{
      url?: string;
    }>;
  };
  code?: string;
  message?: string;
};

function getDashScopeApiBase() {
  const baseUrl = aiConfig.baseURL.replace(/\/$/, "");
  const origin = new URL(baseUrl).origin;

  return `${origin}/api/v1`;
}

function getDashScopeImageSynthesisEndpoint() {
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname)) {
    return "/api/ai/services/aigc/image2image/image-synthesis";
  }

  return `${getDashScopeApiBase()}/services/aigc/image2image/image-synthesis`;
}

function getDashScopeTaskEndpoint(taskId: string) {
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname)) {
    return `/api/ai/tasks/${taskId}`;
  }

  return `${getDashScopeApiBase()}/tasks/${taskId}`;
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("AI 返回了无法读取的图片结果，请稍后重试。"));
    };

    reader.onerror = () => reject(new Error("AI 返回了无法读取的图片结果，请稍后重试。"));
    reader.readAsDataURL(blob);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("AI 修复处理超时，请稍后重试。"));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildDashScopeErrorMessage(payloadMessage: string | undefined, fallbackMessage: string) {
  const rawMessage = payloadMessage?.trim();
  const normalized = rawMessage?.toLowerCase() ?? "";

  const providerAccountIssue =
    normalized.includes("access denied") ||
    normalized.includes("good standing") ||
    normalized.includes("overdue payment") ||
    normalized.includes("insufficient balance") ||
    normalized.includes("quota") ||
    normalized.includes("forbidden");

  if (providerAccountIssue) {
    return `AI 修复当前不可用：阿里云模型服务账号状态异常、余额不足或无权限，请检查 DashScope 账户余额、服务权限和 API Key。原始错误：${rawMessage}`;
  }

  if (normalized.includes("unauthorized") || normalized.includes("invalid api key") || normalized.includes("api key")) {
    return `AI 修复当前不可用：DashScope API Key 无效或权限不足，请检查 src/features/editor/runtime/aiConfig.ts 中的配置。原始错误：${rawMessage}`;
  }

  if (normalized.includes("timeout")) {
    return "AI 修复处理超时，请稍后重试。";
  }

  if (normalized.includes("network") || normalized.includes("failed to fetch")) {
    return "AI 修复请求失败：网络连接异常，暂时无法访问模型服务。";
  }

  if (rawMessage) {
    return `${fallbackMessage} 原始错误：${rawMessage}`;
  }

  return fallbackMessage;
}

async function fetchResultAsDataUrl(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`AI 修复结果图片下载失败（${response.status}）。`);
  }

  return blobToDataUrl(await response.blob());
}

async function createDashScopeTask(input: AiEditInput) {
  const response = await fetch(getDashScopeImageSynthesisEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiConfig.apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable"
    },
    body: JSON.stringify({
      model: aiConfig.model,
      input: {
        function: "description_edit_with_mask",
        prompt: input.prompt?.trim() || "修复遮罩区域，使结果自然、边缘融合。",
        base_image_url: input.sourceDataUrl,
        mask_image_url: input.maskDataUrl
      },
      parameters: {
        n: 1
      }
    })
  });

  const payload = (await response.json()) as DashScopeTaskCreatePayload;

  if (!response.ok) {
    throw new Error(
      buildDashScopeErrorMessage(
        payload.message || payload.code,
        `AI 修复任务创建失败（${response.status}）。`
      )
    );
  }

  const taskId = payload.output?.task_id;

  if (!taskId) {
    throw new Error("AI 修复任务创建成功，但没有返回 task_id。");
  }

  return taskId;
}

async function pollDashScopeTask(taskId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < aiConfig.timeoutMs) {
    const response = await fetch(getDashScopeTaskEndpoint(taskId), {
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey}`
      }
    });

    const payload = (await response.json()) as DashScopeTaskResultPayload;

    if (!response.ok) {
      throw new Error(
        buildDashScopeErrorMessage(
          payload.message || payload.code || payload.output?.message || payload.output?.code,
          `AI 修复任务查询失败（${response.status}）。`
        )
      );
    }

    const status = payload.output?.task_status;

    if (status === "SUCCEEDED") {
      const url = payload.output?.results?.[0]?.url;

      if (!url) {
        throw new Error("AI 修复成功，但没有返回结果图片。");
      }

      return fetchResultAsDataUrl(url);
    }

    if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") {
      throw new Error(
        buildDashScopeErrorMessage(
          payload.output?.message || payload.output?.code,
          `AI 修复失败，任务状态：${status}。`
        )
      );
    }

    await wait(1500);
  }

  throw new Error("AI 修复处理超时，请稍后重试。");
}

async function callDashScopeMaskedEdit(input: AiEditInput): Promise<AiBridgeResult> {
  if (!hasAiConfig()) {
    return {
      success: false,
      imageDataUrl: null,
      errorMessage: "AI 配置不完整，请先在 src/features/editor/runtime/aiConfig.ts 中填写 DashScope 的 baseURL、apiKey 和 model。"
    };
  }

  try {
    const taskId = await withTimeout(createDashScopeTask(input), aiConfig.timeoutMs);
    const imageDataUrl = await withTimeout(pollDashScopeTask(taskId), aiConfig.timeoutMs + 15_000);

    return {
      success: true,
      imageDataUrl,
      errorMessage: null
    };
  } catch (error) {
    return {
      success: false,
      imageDataUrl: null,
      errorMessage: error instanceof Error ? error.message : "AI 修复失败，请稍后重试。"
    };
  }
}

export async function inpaintImage(input: AiEditInput) {
  return callDashScopeMaskedEdit(input);
}

export async function outpaintImage(input: AiEditInput) {
  return callDashScopeMaskedEdit(input);
}
