import type { ImageLayer, RepairStroke } from "../model/document";
import { aiConfig, hasAiConfig } from "./aiConfig";

export type RepairMode = "guided_repaint" | "inpainting";

export type RepairMaskAnalysis = {
  areaRatio: number;
  regionCount: number;
  touchesEdge: boolean;
  shapeHint: "compact" | "elongated" | "scattered";
};

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
  guideDataUrl?: string;
  prompt: string;
  mode: RepairMode;
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
  result?: Array<{ url?: string }>;
  content?: {
    image_url?: string;
    file_url?: string;
  };
  task?: {
    task_id?: string;
    status?: string;
    result?: Array<{ url?: string }>;
    content?: {
      image_url?: string;
      file_url?: string;
    };
    error_message?: string;
    error_code?: string;
  };
  error?: string;
  message?: string;
  error_message?: string;
  error_code?: string;
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

function getImageGenerationEndpoint() {
  const base = getApiBase();
  if (base === "/api/ai") {
    return `${base}/images/generations`;
  }
  return `${base}/api/v3/images/generations`;
}

function getImageGenerationStatusEndpoint(taskId: string) {
  const base = getApiBase();
  if (base === "/api/ai") {
    return `${base}/images/generations/${taskId}`;
  }
  return `${base}/api/v3/images/generations/${taskId}`;
}

function getImageEditEndpoint() {
  return getImageGenerationEndpoint();
}

function getImageEditStatusEndpoint(taskId: string) {
  return getImageGenerationStatusEndpoint(taskId);
}

function getRepairGenerationEndpoint() {
  const base = getApiBase();
  if (base === "/api/ai") {
    return `${base}/contents/generations/tasks`;
  }

  return `${base}/api/v3/contents/generations/tasks`;
}

function getRepairGenerationStatusEndpoint(taskId: string) {
  return `${getRepairGenerationEndpoint()}/${taskId}`;
}

function normalizeStatus(status?: string): ImageRepairTaskResult["status"] {
  const normalized = status?.toLowerCase() ?? "";

  if (normalized.includes("succeed") || normalized.includes("complete") || normalized === "done") {
    return "succeeded";
  }

  if (
    normalized.includes("run") ||
    normalized.includes("process") ||
    normalized.includes("queue") ||
    normalized.includes("pending") ||
    normalized.includes("generate")
  ) {
    return normalized.includes("pending") ? "pending" : "running";
  }

  return normalized ? "failed" : "pending";
}

function extractTaskId(payload: ImageEditResponse) {
  return payload.taskId ?? payload.task_id ?? payload.id ?? payload.task?.task_id ?? null;
}

function extractResultUrl(payload: ImageEditResponse) {
  return (
    payload.resultUrl ??
    payload.url ??
    payload.image_url ??
    payload.output?.[0]?.url ??
    payload.data?.[0]?.url ??
    payload.result?.[0]?.url ??
    payload.content?.image_url ??
    payload.content?.file_url ??
    payload.task?.result?.[0]?.url ??
    payload.task?.content?.image_url ??
    payload.task?.content?.file_url ??
    null
  );
}

function buildErrorMessage(payload: ImageEditResponse, fallback: string) {
  return (
    payload.error?.trim() ||
    payload.message?.trim() ||
    payload.error_message?.trim() ||
    payload.task?.error_message?.trim() ||
    payload.error_code?.trim() ||
    payload.task?.error_code?.trim() ||
    fallback
  );
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

function createCanvas(width: number, height: number) {
  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function getCanvasContext(canvas: HTMLCanvasElement, errorMessage: string) {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(errorMessage);
  }

  return context;
}

function mapStrokePointToCrop(layer: ImageLayer, point: RepairStroke["points"][number]) {
  const scaleX = layer.transform.scaleX || 1;
  const scaleY = layer.transform.scaleY || 1;
  const imageX = (point.x - layer.transform.x) / scaleX + layer.crop.x;
  const imageY = (point.y - layer.transform.y) / scaleY + layer.crop.y;

  return {
    x: imageX - layer.crop.x,
    y: imageY - layer.crop.y
  };
}

function paintStrokePath(
  context: CanvasRenderingContext2D,
  layer: ImageLayer,
  stroke: RepairStroke,
  options: {
    paintStyle: string;
    eraseStyle?: string;
    compositePaint?: GlobalCompositeOperation;
    compositeErase?: GlobalCompositeOperation;
    drawSinglePoint?: boolean;
  }
) {
  if (stroke.points.length === 0) {
    return;
  }

  const scaleX = layer.transform.scaleX || 1;
  const scaleY = layer.transform.scaleY || 1;
  const radius = Math.max(1, stroke.brushSize / Math.max(scaleX, scaleY, 0.001));

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = radius;
  context.globalCompositeOperation =
    stroke.mode === "erase"
      ? options.compositeErase ?? "source-over"
      : options.compositePaint ?? "source-over";
  context.strokeStyle = stroke.mode === "erase" ? options.eraseStyle ?? "#000000" : options.paintStyle;
  context.fillStyle = stroke.mode === "erase" ? options.eraseStyle ?? "#000000" : options.paintStyle;

  if (stroke.points.length === 1 && options.drawSinglePoint) {
    const singlePoint = mapStrokePointToCrop(layer, stroke.points[0]);
    context.beginPath();
    context.arc(singlePoint.x, singlePoint.y, radius / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();

    return;
  }

  if (stroke.points.length < 2) {
    context.restore();

    return;
  }

  context.beginPath();
  stroke.points.forEach((point, index) => {
    const cropPoint = mapStrokePointToCrop(layer, point);

    if (index === 0) {
      context.moveTo(cropPoint.x, cropPoint.y);
    } else {
      context.lineTo(cropPoint.x, cropPoint.y);
    }
  });
  context.stroke();
  context.restore();
}

function renderRepairMaskCanvas(layer: ImageLayer, strokes: RepairStroke[]) {
  const canvas = createCanvas(layer.crop.width, layer.crop.height);
  const context = getCanvasContext(canvas, "Failed to create repair mask canvas.");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);

  strokes.forEach((stroke) => {
    paintStrokePath(context, layer, stroke, {
      paintStyle: "#ffffff",
      eraseStyle: "#000000",
      drawSinglePoint: true
    });
  });

  return canvas;
}

function renderRepairGuideOverlayCanvas(layer: ImageLayer, strokes: RepairStroke[]) {
  const canvas = createCanvas(layer.crop.width, layer.crop.height);
  const context = getCanvasContext(canvas, "Failed to create repair guide canvas.");

  context.clearRect(0, 0, canvas.width, canvas.height);

  strokes.forEach((stroke) => {
    paintStrokePath(context, layer, stroke, {
      paintStyle: "rgba(255, 67, 54, 0.34)",
      eraseStyle: "rgba(0, 0, 0, 1)",
      compositeErase: "destination-out",
      drawSinglePoint: true
    });
  });

  context.save();
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  context.shadowBlur = 10;
  context.shadowColor = "rgba(255, 67, 54, 0.38)";
  strokes.forEach((stroke) => {
    if (stroke.mode !== "paint") {
      return;
    }

    paintStrokePath(context, layer, stroke, {
      paintStyle: "rgba(255, 255, 255, 0.9)",
      drawSinglePoint: true
    });
  });
  context.restore();

  return canvas;
}

export async function renderImageLayerCropDataUrl(layer: ImageLayer) {
  if (layer.source === "pending-upload") {
    throw new Error("Please import an image before running AI repair.");
  }

  const image = await loadImageElement(layer.source);
  const canvas = createCanvas(layer.crop.width, layer.crop.height);
  const context = getCanvasContext(canvas, "Failed to create repair input canvas.");

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
  return renderRepairMaskCanvas(layer, strokes).toDataURL("image/png");
}

export async function renderRepairGuideDataUrl(layer: ImageLayer, strokes: RepairStroke[]) {
  if (layer.source === "pending-upload") {
    throw new Error("Please import an image before running AI repair.");
  }

  const image = await loadImageElement(layer.source);
  const canvas = createCanvas(layer.crop.width, layer.crop.height);
  const context = getCanvasContext(canvas, "Failed to create repair guide canvas.");
  const overlayCanvas = renderRepairGuideOverlayCanvas(layer, strokes);

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

  context.drawImage(overlayCanvas, 0, 0);

  return canvas.toDataURL("image/png");
}

export async function analyzeRepairMask(maskDataUrl: string): Promise<RepairMaskAnalysis> {
  const image = await loadImageElement(maskDataUrl);
  const canvas = createCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const context = getCanvasContext(canvas, "Failed to inspect repair mask.");

  context.drawImage(image, 0, 0);

  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const activePixels: Array<{ x: number; y: number }> = [];
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const value = data[index];

      if (value > 200) {
        activePixels.push({ x, y });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (activePixels.length === 0) {
    return {
      areaRatio: 0,
      regionCount: 0,
      touchesEdge: false,
      shapeHint: "compact"
    };
  }

  const sample = Math.max(8, Math.round(Math.min(width, height) / 28));
  const gridWidth = Math.ceil(width / sample);
  const gridHeight = Math.ceil(height / sample);
  const grid = Array.from({ length: gridHeight }, () => Array.from({ length: gridWidth }, () => false));

  activePixels.forEach(({ x, y }) => {
    grid[Math.floor(y / sample)][Math.floor(x / sample)] = true;
  });

  const visited = Array.from({ length: gridHeight }, () => Array.from({ length: gridWidth }, () => false));
  let regionCount = 0;

  for (let row = 0; row < gridHeight; row += 1) {
    for (let column = 0; column < gridWidth; column += 1) {
      if (!grid[row][column] || visited[row][column]) {
        continue;
      }

      regionCount += 1;
      const queue = [[row, column]];
      visited[row][column] = true;

      while (queue.length > 0) {
        const [currentRow, currentColumn] = queue.shift()!;
        const neighbors = [
          [currentRow - 1, currentColumn],
          [currentRow + 1, currentColumn],
          [currentRow, currentColumn - 1],
          [currentRow, currentColumn + 1]
        ];

        neighbors.forEach(([nextRow, nextColumn]) => {
          if (
            nextRow < 0 ||
            nextColumn < 0 ||
            nextRow >= gridHeight ||
            nextColumn >= gridWidth ||
            visited[nextRow][nextColumn] ||
            !grid[nextRow][nextColumn]
          ) {
            return;
          }

          visited[nextRow][nextColumn] = true;
          queue.push([nextRow, nextColumn]);
        });
      }
    }
  }

  const areaRatio = activePixels.length / (width * height);
  const boundsWidth = Math.max(1, maxX - minX + 1);
  const boundsHeight = Math.max(1, maxY - minY + 1);
  const aspectRatio = Math.max(boundsWidth / boundsHeight, boundsHeight / boundsWidth);
  const fillRatio = activePixels.length / (boundsWidth * boundsHeight);
  const touchesEdge = minX <= 1 || minY <= 1 || maxX >= width - 2 || maxY >= height - 2;

  let shapeHint: RepairMaskAnalysis["shapeHint"] = "compact";
  if (aspectRatio >= 3.2 || (aspectRatio >= 2.4 && fillRatio < 0.45)) {
    shapeHint = "elongated";
  } else if (regionCount >= 3 || fillRatio < 0.25) {
    shapeHint = "scattered";
  }

  return {
    areaRatio,
    regionCount,
    touchesEdge,
    shapeHint
  };
}

export function buildRepairPrompt(
  layer: Pick<ImageLayer, "aiMeta">,
  repairSession: { feather?: number } | null,
  analysis: RepairMaskAnalysis
) {
  const userPrompt = layer.aiMeta.repairPrompt.trim();
  const areaPercent = Math.max(1, Math.round(analysis.areaRatio * 100));
  const regionHint =
    analysis.regionCount <= 1
      ? "只有一个高亮目标区域。"
      : `有 ${analysis.regionCount} 个高亮目标区域。`;
  const shapeHint =
    analysis.shapeHint === "elongated"
      ? "高亮标记呈长条状，类似水印文字或logo条带。"
      : analysis.shapeHint === "scattered"
        ? "高亮标记分散分布，需要分别局部清除。"
        : "高亮标记较为紧凑，应进行局部修复。";
  const edgeHint = analysis.touchesEdge
    ? "高亮区域接触图像边缘，请小心保持构图和边缘连续性。"
    : "高亮区域完全在画面内部。";
  const featherHint =
    typeof repairSession?.feather === "number" && repairSession.feather > 0
      ? `使用羽化过渡将修复区域与周围像素柔和混合，羽化强度为 ${Math.round(repairSession.feather)}。`
      : "将修复区域与周围像素自然混合。";

  return [
    "仅移除高亮区域内的水印或不需要的标记。",
    "以原始图像为基准，将高亮参考图像作为编辑指南。",
    "保持所有非高亮内容不变。",
    "不要改变产品边缘、人物面部、标记外的背景物体、高亮区域外的文字、光照、构图或色调。",
    "自然重建底层纹理、渐变、阴影和边缘。",
    regionHint,
    shapeHint,
    edgeHint,
    `高亮区域约占裁剪图像的 ${areaPercent}%。`,
    featherHint,
    userPrompt ? `用户额外指导：${userPrompt}` : null
  ]
    .filter(Boolean)
    .join(" ");
}

async function pollImageEditTask(taskId: string): Promise<ImageRepairTaskResult> {
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

    const status = normalizeStatus(payload.status ?? payload.task?.status);
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

async function pollGuidedRepairTask(taskId: string, model: string): Promise<ImageRepairTaskResult> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < aiConfig.timeoutMs) {
    const response = await fetch(getRepairGenerationStatusEndpoint(taskId), {
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
        providerModel: payload.providerModel ?? payload.model ?? model,
        errorMessage: buildErrorMessage(payload, `AI repair request failed with ${response.status}.`)
      };
    }

    const status = normalizeStatus(payload.status ?? payload.task?.status);
    const resultUrl = extractResultUrl(payload);

    if (status === "succeeded" && resultUrl) {
      return {
        taskId,
        status,
        resultUrl,
        providerModel: payload.providerModel ?? payload.model ?? model,
        errorMessage: null
      };
    }

    if (status === "failed") {
      return {
        taskId,
        status,
        resultUrl: null,
        providerModel: payload.providerModel ?? payload.model ?? model,
        errorMessage: buildErrorMessage(payload, "AI guided repair failed.")
      };
    }

    await wait(1500);
  }

  return {
    taskId,
    status: "failed",
    resultUrl: null,
    providerModel: model,
    errorMessage: "AI repair timed out."
  };
}

async function runGuidedRepaintTask({
  imageDataUrl,
  guideDataUrl,
  prompt,
  model
}: ImageRepairTaskInput): Promise<ImageRepairTaskResult> {
  if (!guideDataUrl) {
    return {
      taskId: null,
      status: "failed",
      resultUrl: null,
      providerModel: model ?? aiConfig.repairModel ?? aiConfig.model,
      errorMessage: "Repair guide image is required for guided repaint mode."
    };
  }

  const providerModel = model || aiConfig.repairModel || aiConfig.model;
  const response = await fetch(getRepairGenerationEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiConfig.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: providerModel,
      content: [
        { type: "text", text: prompt.trim() },
        { type: "image_url", image_url: { url: imageDataUrl } },
        { type: "image_url", image_url: { url: guideDataUrl } }
      ],
      parameters: {
        n: 1
      }
    })
  });

  const payload = (await response.json()) as ImageEditResponse;

  if (!response.ok) {
    return {
      taskId: extractTaskId(payload),
      status: "failed",
      resultUrl: null,
      providerModel,
      errorMessage: buildErrorMessage(payload, `AI repair request failed with ${response.status}.`)
    };
  }

  const taskId = extractTaskId(payload);
  const resultUrl = extractResultUrl(payload);
  const status = normalizeStatus(payload.status ?? payload.task?.status);

  if (resultUrl) {
    return {
      taskId,
      status: status === "failed" ? "succeeded" : status,
      resultUrl,
      providerModel,
      errorMessage: null
    };
  }

  if (taskId) {
    return pollGuidedRepairTask(taskId, providerModel);
  }

  return {
    taskId: null,
    status: "failed",
    resultUrl: null,
    providerModel,
    errorMessage: buildErrorMessage(payload, "AI repair did not return a result.")
  };
}

async function runInpaintingTask({
  imageDataUrl,
  maskDataUrl,
  guideDataUrl,
  prompt,
  model
}: ImageRepairTaskInput): Promise<ImageRepairTaskResult> {
  const providerModel = model || aiConfig.repairModel || aiConfig.model;
  
  const images: string[] = [imageDataUrl];
  if (guideDataUrl) {
    images.push(guideDataUrl);
  }
  
  const response = await fetch(getImageGenerationEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiConfig.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: providerModel,
      prompt: prompt.trim(),
      image: images,
      sequential_image_generation: "disabled",
      response_format: "url",
      size: "2K",
      stream: false,
      watermark: true
    })
  });

  const payload = (await response.json()) as ImageEditResponse;

  if (!response.ok) {
    return {
      taskId: extractTaskId(payload),
      status: "failed",
      resultUrl: null,
      providerModel,
      errorMessage: buildErrorMessage(payload, `AI repair request failed with ${response.status}.`)
    };
  }

  const taskId = extractTaskId(payload);
  const resultUrl = extractResultUrl(payload);
  const status = normalizeStatus(payload.status ?? payload.task?.status);

  if (resultUrl) {
    return {
      taskId,
      status: status === "failed" ? "succeeded" : status,
      resultUrl,
      providerModel,
      errorMessage: null
    };
  }

  if (taskId) {
    return pollImageEditTask(taskId);
  }

  return {
    taskId: null,
    status: "failed",
    resultUrl: null,
    providerModel,
    errorMessage: buildErrorMessage(payload, "AI repair did not return a result.")
  };
}

export async function runImageRepairTask(input: ImageRepairTaskInput): Promise<ImageRepairTaskResult> {
  if (!hasAiConfig()) {
    return {
      taskId: null,
      status: "failed",
      resultUrl: null,
      providerModel: null,
      errorMessage: "AI is not configured. Please set the required environment variables first."
    };
  }

  if (input.mode === "guided_repaint") {
    return runGuidedRepaintTask(input);
  }

  return runInpaintingTask(input);
}
