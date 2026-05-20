import type { ImageLayer, RepairStroke } from "../model/document";
import { aiConfig, hasAiConfig } from "./aiConfig";

export type ImageRepairTaskResult = {
  taskId: string | null;
  status: "pending" | "running" | "succeeded" | "failed";
  resultUrl: string | null;
  providerModel: string | null;
  errorMessage: string | null;
};

type ImageRepairTaskInput = {
  imageDataUrl: string;
  maskDataUrl: string;
  prompt: string;
  model?: string;
};

type ImageEditResponse = {
  id?: string;
  taskId?: string;
  task_id?: string;
  status?: string;
  url?: string;
  resultUrl?: string;
  image_url?: string;
  providerModel?: string;
  model?: string;
  output?: Array<{ url?: string }>;
  data?: Array<{ url?: string }>;
  error?: string;
  message?: string;
};

function getApiBase() {
  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname)
  ) {
    return "/api/ai";
  }

  return aiConfig.baseURL.replace(/\/$/, "");
}

function getImageEditEndpoint() {
  return `${getApiBase()}/image-edits`;
}

function getImageEditStatusEndpoint(taskId: string) {
  return `${getImageEditEndpoint()}/${taskId}`;
}

function normalizeStatus(status?: string): ImageRepairTaskResult["status"] {
  const normalized = status?.toLowerCase() ?? "";

  if (normalized.includes("succeed") || normalized.includes("complete") || normalized === "done") {
    return "succeeded";
  }

  if (normalized.includes("run") || normalized.includes("process") || normalized.includes("queue")) {
    return "running";
  }

  return "failed";
}

function extractResultUrl(payload: ImageEditResponse) {
  return (
    payload.resultUrl ??
    payload.url ??
    payload.image_url ??
    payload.output?.[0]?.url ??
    payload.data?.[0]?.url ??
    null
  );
}

function buildErrorMessage(payload: ImageEditResponse, fallback: string) {
  return payload.error?.trim() || payload.message?.trim() || fallback;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function getImageSizeFromSource(source: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height
      });
    };
    image.onerror = () => reject(new Error("Failed to read repaired image dimensions."));
    image.src = source;
  });
}

async function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image source."));
    image.src = source;
  });
}

export async function renderImageLayerCropDataUrl(layer: ImageLayer) {
  if (layer.source === "pending-upload") {
    throw new Error("Please import an image before running AI repair.");
  }

  const image = await loadImageElement(layer.source);
  const canvas = window.document.createElement("canvas");
  canvas.width = layer.crop.width;
  canvas.height = layer.crop.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create repair input canvas.");
  }

  context.drawImage(
    image,
    layer.crop.x,
    layer.crop.y,
    layer.crop.width,
    layer.crop.height,
    0,
    0,
    layer.crop.width,
    layer.crop.height
  );

  return canvas.toDataURL("image/png");
}

export async function renderRepairMaskDataUrl(layer: ImageLayer, strokes: RepairStroke[]) {
  const canvas = window.document.createElement("canvas");
  canvas.width = layer.crop.width;
  canvas.height = layer.crop.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create repair mask canvas.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#ffffff";
  context.lineCap = "round";
  context.lineJoin = "round";

  const scaleX = layer.transform.scaleX || 1;
  const scaleY = layer.transform.scaleY || 1;

  strokes.forEach((stroke) => {
    if (stroke.points.length < 2) {
      return;
    }

    context.beginPath();
    context.lineWidth = Math.max(1, stroke.brushSize / Math.max(scaleX, scaleY, 0.001));

    stroke.points.forEach((point, index) => {
      const imageX = (point.x - layer.transform.x) / scaleX + layer.crop.x;
      const imageY = (point.y - layer.transform.y) / scaleY + layer.crop.y;
      const cropX = imageX - layer.crop.x;
      const cropY = imageY - layer.crop.y;

      if (index === 0) {
        context.moveTo(cropX, cropY);
      } else {
        context.lineTo(cropX, cropY);
      }
    });

    context.stroke();
  });

  return canvas.toDataURL("image/png");
}

async function pollImageRepairTask(taskId: string): Promise<ImageRepairTaskResult> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < aiConfig.timeoutMs) {
    const response = await fetch(getImageEditStatusEndpoint(taskId), {
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey}`,
        "Content-Type": "application/json"
      }
    });

    const payload = (await response.json()) as ImageEditResponse;

    if (!response.ok) {
      return {
        taskId,
        status: "failed",
        resultUrl: null,
        providerModel: payload.providerModel ?? payload.model ?? aiConfig.repairModel ?? null,
        errorMessage: buildErrorMessage(payload, `AI repair request failed with ${response.status}.`)
      };
    }

    const status = normalizeStatus(payload.status);
    const resultUrl = extractResultUrl(payload);

    if (status === "succeeded" && resultUrl) {
      return {
        taskId,
        status,
        resultUrl,
        providerModel: payload.providerModel ?? payload.model ?? aiConfig.repairModel ?? null,
        errorMessage: null
      };
    }

    if (status === "failed") {
      return {
        taskId,
        status,
        resultUrl: null,
        providerModel: payload.providerModel ?? payload.model ?? aiConfig.repairModel ?? null,
        errorMessage: buildErrorMessage(payload, "AI repair failed.")
      };
    }

    await wait(1500);
  }

  return {
    taskId,
    status: "failed",
    resultUrl: null,
    providerModel: aiConfig.repairModel || null,
    errorMessage: "AI repair timed out."
  };
}

export async function runImageRepairTask({
  imageDataUrl,
  maskDataUrl,
  prompt,
  model
}: ImageRepairTaskInput): Promise<ImageRepairTaskResult> {
  if (!hasAiConfig()) {
    return {
      taskId: null,
      status: "failed",
      resultUrl: null,
      providerModel: null,
      errorMessage: "AI is not configured. Please set the required environment variables first."
    };
  }

  const response = await fetch(getImageEditEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiConfig.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model || aiConfig.repairModel || aiConfig.model,
      prompt: prompt.trim(),
      image: imageDataUrl,
      mask: maskDataUrl
    })
  });

  const payload = (await response.json()) as ImageEditResponse;

  if (!response.ok) {
    return {
      taskId: payload.taskId ?? payload.task_id ?? payload.id ?? null,
      status: "failed",
      resultUrl: null,
      providerModel: payload.providerModel ?? payload.model ?? aiConfig.repairModel ?? null,
      errorMessage: buildErrorMessage(payload, `AI repair request failed with ${response.status}.`)
    };
  }

  const taskId = payload.taskId ?? payload.task_id ?? payload.id ?? null;
  const resultUrl = extractResultUrl(payload);
  const status = normalizeStatus(payload.status);

  if (resultUrl) {
    return {
      taskId,
      status: status === "failed" ? "succeeded" : status,
      resultUrl,
      providerModel: payload.providerModel ?? payload.model ?? aiConfig.repairModel ?? null,
      errorMessage: null
    };
  }

  if (taskId) {
    return pollImageRepairTask(taskId);
  }

  return {
    taskId: null,
    status: "failed",
    resultUrl: null,
    providerModel: payload.providerModel ?? payload.model ?? aiConfig.repairModel ?? null,
    errorMessage: buildErrorMessage(payload, "AI repair did not return a result.")
  };
}
