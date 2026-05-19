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

      reject(new Error("AI 返回图片读取失败。"));
    };

    reader.onerror = () => reject(new Error("AI 返回图片读取失败。"));
    reader.readAsDataURL(blob);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("AI 处理超时，请稍后重试。"));
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

async function fetchResultAsDataUrl(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`AI 结果图片下载失败（${response.status}）。`);
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
    throw new Error(payload.message || payload.code || `AI 修复任务创建失败（${response.status}）。`);
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
      throw new Error(payload.message || payload.code || `AI 修复任务查询失败（${response.status}）。`);
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
      throw new Error(payload.output?.message || payload.output?.code || `AI 修复失败，任务状态：${status}。`);
    }

    await wait(1500);
  }

  throw new Error("AI 修复超时，请稍后重试。");
}

async function callDashScopeMaskedEdit(input: AiEditInput): Promise<AiBridgeResult> {
  if (!hasAiConfig()) {
    return {
      success: false,
      imageDataUrl: null,
      errorMessage: "请先在 aiConfig.ts 中配置 DashScope 的 baseURL、apiKey 和 model。"
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
      errorMessage: error instanceof Error ? error.message : "AI 修复失败。"
    };
  }
}

export async function inpaintImage(input: AiEditInput) {
  return callDashScopeMaskedEdit(input);
}

export async function outpaintImage(input: AiEditInput) {
  return callDashScopeMaskedEdit(input);
}
