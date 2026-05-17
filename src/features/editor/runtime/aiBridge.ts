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

type AiJsonSuccessPayload = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
};

type AiJsonErrorPayload = {
  error?: {
    message?: string;
  };
};

function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("无法把 AI 返回图片转换成可预览的数据格式。"));
    };

    reader.onerror = () => reject(new Error("无法读取 AI 返回的图片结果。"));
    reader.readAsDataURL(blob);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("AI 请求超时，请稍后重试。"));
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

function isSuccessPayload(payload: unknown): payload is AiJsonSuccessPayload {
  return typeof payload === "object" && payload !== null && "data" in payload;
}

function isErrorPayload(payload: unknown): payload is AiJsonErrorPayload {
  return typeof payload === "object" && payload !== null && "error" in payload;
}

async function normalizeImageResult(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as unknown;

    if (isSuccessPayload(payload)) {
      const record = payload.data?.[0];

      if (record?.b64_json) {
        return `data:image/png;base64,${record.b64_json}`;
      }

      if (record?.url) {
        return record.url;
      }
    }

    if (isErrorPayload(payload)) {
      throw new Error(payload.error?.message ?? "AI 没有返回可用的图片结果。");
    }

    throw new Error("AI 返回格式不符合预期，暂时无法解析。");
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

async function callOpenAiCompatibleEdit(input: AiEditInput): Promise<AiBridgeResult> {
  if (!hasAiConfig()) {
    return {
      success: false,
      imageDataUrl: null,
      errorMessage:
        "请先在 aiConfig.ts 中填写 baseURL、apiKey 和 model，然后再执行 AI 修图。"
    };
  }

  const formData = new FormData();
  formData.append("model", aiConfig.model);
  formData.append("prompt", input.prompt);
  formData.append("size", input.size);
  formData.append("response_format", "b64_json");
  formData.append("image", dataUrlToBlob(input.sourceDataUrl), "image.png");
  formData.append("mask", dataUrlToBlob(input.maskDataUrl), "mask.png");

  try {
    const response = await withTimeout(
      fetch(`${aiConfig.baseURL.replace(/\/$/, "")}/images/edits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiConfig.apiKey}`
        },
        body: formData
      }),
      aiConfig.timeoutMs
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        imageDataUrl: null,
        errorMessage: errorText || `AI 请求失败，状态码 ${response.status}。`
      };
    }

    const imageDataUrl = await normalizeImageResult(response);

    return {
      success: true,
      imageDataUrl,
      errorMessage: null
    };
  } catch (error) {
    return {
      success: false,
      imageDataUrl: null,
      errorMessage: error instanceof Error ? error.message : "AI 请求失败，请稍后重试。"
    };
  }
}

export async function inpaintImage(input: AiEditInput) {
  return callOpenAiCompatibleEdit(input);
}

export async function outpaintImage(input: AiEditInput) {
  return callOpenAiCompatibleEdit(input);
}
