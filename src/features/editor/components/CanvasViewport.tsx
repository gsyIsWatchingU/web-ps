import { Canvas } from "fabric";
import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import type {
  CanvasBackgroundMode,
  CanvasViewport as DocumentCanvasViewport,
  DoodlePoint,
  DoodleLayer,
  EditorDocument,
  EditorTool,
  ImageCrop,
  ImageLayer,
  RepairStroke
} from "../model/document";
import { getDefaultSafeAreaInset, isDefaultCanvasViewport } from "../model/document";
import { seedCanvas } from "../runtime/seedCanvas";

type CropSession = {
  layerId: string;
  draft: ImageCrop;
} | null;

type RepairSession = {
  layerId: string;
  strokes: RepairStroke[];
  brushSize: number;
  feather: number;
  toolMode: "brush" | "eraser";
  guidePreviewEnabled: boolean;
  isSubmitting: boolean;
} | null;

type CanvasViewportProps = {
  activeTool: EditorTool;
  cropSession: CropSession;
  repairSession: RepairSession;
  document: EditorDocument;
  selectedImageLayer: ImageLayer | null;
  selectedLayerIds: string[];
  onSelectionChange: (layerIds: string[]) => void;
  onTextChange: (layerId: string, content: string) => void;
  onTransformChange: (
    layerId: string,
    transform: {
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
      rotation: number;
      flipX: boolean;
      flipY: boolean;
    }
  ) => void;
  onViewportChange: (viewport: Partial<EditorDocument["canvas"]["viewport"]>) => void;
  doodleStyle: Pick<DoodleLayer, "stroke" | "strokeWidth">;
  onDoodleCommit: (points: DoodlePoint[]) => void;
  onRepairStrokeCommit: (points: DoodlePoint[]) => void;
  onCropSessionChange: (crop: Partial<ImageCrop>) => void;
};

type LayerCanvasObject = {
  left?: number;
  top?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  flipX?: boolean;
  flipY?: boolean;
  data?: { layerId?: string };
  text?: string;
};

type CropHandle = "move" | "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se" | null;
type DocumentRect = { x: number; y: number; width: number; height: number };
type CropPreviewBounds = {
  imageBounds: DocumentRect;
  cropBounds: DocumentRect;
};
type SafeAreaHintLayout = {
  cardRect: DocumentRect;
  closeButtonRect: DocumentRect;
};

type ViewportBounds = {
  width: number;
  height: number;
};

function getLayerId(target: unknown) {
  return (target as LayerCanvasObject | undefined)?.data?.layerId ?? null;
}

function applyViewport(runtime: Canvas, zoom: number, panX: number, panY: number) {
  runtime.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
  runtime.requestRenderAll();
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function clampZoom(zoom: number) {
  return Math.min(3, Math.max(0.2, zoom));
}

function clampFitZoom(zoom: number) {
  return Math.min(1, Math.max(0.2, zoom));
}

function clampPan(
  panX: number,
  panY: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
  viewportWidth: number,
  viewportHeight: number
): { panX: number; panY: number } {
  const scaledCanvasWidth = canvasWidth * zoom;
  const scaledCanvasHeight = canvasHeight * zoom;
  const maxPanX = Math.max(0, viewportWidth - scaledCanvasWidth);
  const maxPanY = Math.max(0, viewportHeight - scaledCanvasHeight);
  return {
    panX: Math.max(0, Math.min(maxPanX, panX)),
    panY: Math.max(0, Math.min(maxPanY, panY))
  };
}

function roundViewport(viewport: DocumentCanvasViewport): DocumentCanvasViewport {
  return {
    zoom: Number(viewport.zoom.toFixed(3)),
    panX: Math.round(viewport.panX),
    panY: Math.round(viewport.panY)
  };
}

function isSameViewport(left: Partial<DocumentCanvasViewport> | null | undefined, right: DocumentCanvasViewport) {
  return left?.zoom === right.zoom && left?.panX === right.panX && left?.panY === right.panY;
}

function calculateCenteredViewport(
  document: EditorDocument,
  bounds: ViewportBounds
): DocumentCanvasViewport {
  const zoom = clampFitZoom(Math.min(bounds.width / document.canvas.width, bounds.height / document.canvas.height));
  const defaultPanY = 70;
  const centeredPanX = (bounds.width - document.canvas.width * zoom) / 2;
  const clamped = clampPan(
    centeredPanX,
    defaultPanY,
    zoom,
    document.canvas.width,
    document.canvas.height,
    bounds.width,
    bounds.height
  );
  return roundViewport({
    zoom,
    panX: clamped.panX,
    panY: clamped.panY
  });
}

function isDirectManipulationTool(activeTool: EditorTool) {
  return ["crop", "doodle", "repair"].includes(activeTool);
}

function getCursorForCropHandle(handle: CropHandle) {
  switch (handle) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "move":
      return "move";
    default:
      return "crosshair";
  }
}

function resolveCanvasCursor(activeTool: EditorTool, isPanning: boolean) {
  if (isPanning) {
    return "grabbing";
  }

  if (isDirectManipulationTool(activeTool)) {
    return "crosshair";
  }

  if (activeTool === "select") {
    return "grab";
  }

  return "default";
}

function syncCanvasObjectInteractivity(
  runtime: Canvas,
  document: EditorDocument,
  activeTool: EditorTool,
  isPanning = false
) {
  const directManipulation = isDirectManipulationTool(activeTool);
  const disableObjectInteraction = directManipulation || isPanning;

  runtime.skipTargetFind = disableObjectInteraction;

  runtime.getObjects().forEach((object) => {
    const layerId = getLayerId(object);
    const layer = layerId ? document.layers.find((item) => item.id === layerId) : null;
    const isLocked = layer?.locked ?? false;
    const canInteract = !disableObjectInteraction && !isLocked;

    object.set({
      selectable: canInteract,
      evented: canInteract,
      hasControls: canInteract,
      hasBorders: canInteract
    });
  });
}

function syncCanvasInteractionMode(
  runtime: Canvas,
  document: EditorDocument,
  activeTool: EditorTool,
  isPanning = false
) {
  const directManipulation = isDirectManipulationTool(activeTool);
  const cursor = resolveCanvasCursor(activeTool, isPanning);

  runtime.selection = !directManipulation && !isPanning;
  syncCanvasObjectInteractivity(runtime, document, activeTool, isPanning);
  runtime.defaultCursor = cursor;
  runtime.hoverCursor = cursor;
  runtime.moveCursor = cursor;

  if (runtime.upperCanvasEl) {
    runtime.upperCanvasEl.style.cursor = cursor;
  }
}

function getCanvasSurfaceStyle(document: EditorDocument): CSSProperties {
  const background = document.canvas.displayBackground ?? {
    mode: "grid" as CanvasBackgroundMode,
    color: document.canvas.backgroundColor
  };

  if (background.mode === "solid") {
    return { backgroundColor: background.color, backgroundImage: "none" };
  }

  if (background.mode === "dots") {
    return {
      backgroundColor: background.color,
      backgroundImage:
        "radial-gradient(circle, rgba(255, 255, 255, 0.72) 1.2px, transparent 1.2px)",
      backgroundSize: "18px 18px"
    };
  }

  return {
    backgroundColor: background.color,
    backgroundImage:
      "linear-gradient(90deg, rgba(255, 255, 255, 0.55) 1px, transparent 1px), linear-gradient(rgba(255, 255, 255, 0.55) 1px, transparent 1px)",
    backgroundSize: "24px 24px"
  };
}

function getPointerClientPosition(event: MouseEvent | TouchEvent) {
  if ("touches" in event && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  if ("changedTouches" in event && event.changedTouches.length > 0) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  }

  return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
}

function mapClientPointToDocument(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  viewport: EditorDocument["canvas"]["viewport"]
) {
  return {
    x: (clientX - rect.left - viewport.panX) / viewport.zoom,
    y: (clientY - rect.top - viewport.panY) / viewport.zoom
  };
}

function isPointInDocumentRect(point: DoodlePoint, rect: DocumentRect | null) {
  if (!rect) {
    return false;
  }

  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function getCropPreviewBounds(layer: ImageLayer, crop: ImageCrop) {
  const scaleX = layer.transform.scaleX || 1;
  const scaleY = layer.transform.scaleY || 1;
  const imageX = layer.transform.x - layer.crop.x * scaleX;
  const imageY = layer.transform.y - layer.crop.y * scaleY;
  const imageWidth = layer.originalWidth * scaleX;
  const imageHeight = layer.originalHeight * scaleY;

  return {
    imageBounds: {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight
    },
    cropBounds: {
      x: imageX + crop.x * scaleX,
      y: imageY + crop.y * scaleY,
      width: crop.width * scaleX,
      height: crop.height * scaleY
    }
  };
}

function resolveCropHandle(docPoint: DoodlePoint, bounds: CropPreviewBounds): CropHandle {
  const edgeTolerance = 12;
  const cornerTolerance = 14;
  const { cropBounds } = bounds;
  const withinX = docPoint.x >= cropBounds.x && docPoint.x <= cropBounds.x + cropBounds.width;
  const withinY = docPoint.y >= cropBounds.y && docPoint.y <= cropBounds.y + cropBounds.height;
  const nearLeft = Math.abs(docPoint.x - cropBounds.x) <= edgeTolerance;
  const nearRight = Math.abs(docPoint.x - (cropBounds.x + cropBounds.width)) <= edgeTolerance;
  const nearTop = Math.abs(docPoint.y - cropBounds.y) <= edgeTolerance;
  const nearBottom = Math.abs(docPoint.y - (cropBounds.y + cropBounds.height)) <= edgeTolerance;

  if (nearLeft && nearTop) return "nw";
  if (nearRight && nearTop) return "ne";
  if (nearLeft && nearBottom) return "sw";
  if (nearRight && nearBottom) return "se";
  if (withinX && nearTop) return "n";
  if (withinX && nearBottom) return "s";
  if (withinY && nearLeft) return "w";
  if (withinY && nearRight) return "e";

  if (
    withinX &&
    withinY &&
    docPoint.x >= cropBounds.x + cornerTolerance &&
    docPoint.x <= cropBounds.x + cropBounds.width - cornerTolerance &&
    docPoint.y >= cropBounds.y + cornerTolerance &&
    docPoint.y <= cropBounds.y + cropBounds.height - cornerTolerance
  ) {
    return "move";
  }

  return null;
}

function drawDoodlePreview(
  context: CanvasRenderingContext2D,
  points: DoodlePoint[],
  viewport: EditorDocument["canvas"]["viewport"],
  doodleStyle: Pick<DoodleLayer, "stroke" | "strokeWidth">
) {
  if (points.length < 2) {
    return;
  }

  context.save();
  context.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.panX, viewport.panY);
  context.beginPath();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = doodleStyle.stroke;
  context.lineWidth = doodleStyle.strokeWidth;
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.stroke();
  context.restore();
}

function drawCropOverlay(
  context: CanvasRenderingContext2D,
  layer: ImageLayer,
  crop: ImageCrop,
  viewport: EditorDocument["canvas"]["viewport"]
) {
  const bounds = getCropPreviewBounds(layer, crop);
  const { imageBounds, cropBounds } = bounds;
  const handleSize = 10;
  const edgeHandleLength = 28;
  const halfHandle = handleSize / 2;
  const handleRects: DocumentRect[] = [
    { x: cropBounds.x - halfHandle, y: cropBounds.y - halfHandle, width: handleSize, height: handleSize },
    { x: cropBounds.x + cropBounds.width / 2 - edgeHandleLength / 2, y: cropBounds.y - halfHandle, width: edgeHandleLength, height: handleSize },
    { x: cropBounds.x + cropBounds.width - halfHandle, y: cropBounds.y - halfHandle, width: handleSize, height: handleSize },
    { x: cropBounds.x + cropBounds.width - halfHandle, y: cropBounds.y + cropBounds.height / 2 - edgeHandleLength / 2, width: handleSize, height: edgeHandleLength },
    { x: cropBounds.x + cropBounds.width - halfHandle, y: cropBounds.y + cropBounds.height - halfHandle, width: handleSize, height: handleSize },
    { x: cropBounds.x + cropBounds.width / 2 - edgeHandleLength / 2, y: cropBounds.y + cropBounds.height - halfHandle, width: edgeHandleLength, height: handleSize },
    { x: cropBounds.x - halfHandle, y: cropBounds.y + cropBounds.height - halfHandle, width: handleSize, height: handleSize },
    { x: cropBounds.x - halfHandle, y: cropBounds.y + cropBounds.height / 2 - edgeHandleLength / 2, width: handleSize, height: edgeHandleLength }
  ];

  context.save();
  context.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.panX, viewport.panY);
  context.fillStyle = "rgba(28, 37, 32, 0.28)";
  context.fillRect(imageBounds.x, imageBounds.y, imageBounds.width, imageBounds.height);
  context.clearRect(cropBounds.x, cropBounds.y, cropBounds.width, cropBounds.height);
  context.strokeStyle = "#cd5c2d";
  context.lineWidth = 2;
  context.strokeRect(cropBounds.x, cropBounds.y, cropBounds.width, cropBounds.height);
  context.fillStyle = "#fff7f0";
  handleRects.forEach((rect) => {
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    context.strokeRect(rect.x, rect.y, rect.width, rect.height);
  });
  context.restore();
}

function computeCropDraftFromPointer(
  layer: ImageLayer,
  handle: Exclude<CropHandle, null>,
  startPoint: DoodlePoint,
  docPoint: DoodlePoint,
  startCrop: ImageCrop
) {
  const deltaX = (docPoint.x - startPoint.x) / (layer.transform.scaleX || 1);
  const deltaY = (docPoint.y - startPoint.y) / (layer.transform.scaleY || 1);
  const minLeft = 0;
  const minTop = 0;
  const maxRight = layer.originalWidth;
  const maxBottom = layer.originalHeight;
  const right = startCrop.x + startCrop.width;
  const bottom = startCrop.y + startCrop.height;

  if (handle === "move") {
    return {
      x: Math.round(startCrop.x + deltaX),
      y: Math.round(startCrop.y + deltaY)
    } satisfies Partial<ImageCrop>;
  }

  const nextLeft = ["w", "nw", "sw"].includes(handle)
    ? clamp(Math.round(startCrop.x + deltaX), minLeft, right - 1)
    : startCrop.x;
  const nextTop = ["n", "nw", "ne"].includes(handle)
    ? clamp(Math.round(startCrop.y + deltaY), minTop, bottom - 1)
    : startCrop.y;
  const nextRight = ["e", "ne", "se"].includes(handle)
    ? clamp(Math.round(right + deltaX), nextLeft + 1, maxRight)
    : right;
  const nextBottom = ["s", "sw", "se"].includes(handle)
    ? clamp(Math.round(bottom + deltaY), nextTop + 1, maxBottom)
    : bottom;

  return {
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft,
    height: nextBottom - nextTop
  } satisfies Partial<ImageCrop>;
}

function drawRepairStroke(
  context: CanvasRenderingContext2D,
  stroke: RepairStroke
) {
  if (stroke.points.length === 0) {
    return;
  }

  const isErase = stroke.mode === "erase";

  context.save();
  context.globalCompositeOperation = isErase ? "destination-out" : "source-over";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = stroke.brushSize;
  context.strokeStyle = isErase ? "rgba(0, 0, 0, 1)" : "rgba(214, 72, 56, 0.34)";
  context.fillStyle = isErase ? "rgba(0, 0, 0, 1)" : "rgba(214, 72, 56, 0.34)";

  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    context.beginPath();
    context.arc(point.x, point.y, stroke.brushSize / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();

    return;
  }

  context.beginPath();
  stroke.points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.stroke();
  context.restore();
}

function drawRepairOverlay(
  context: CanvasRenderingContext2D,
  layer: ImageLayer,
  strokes: RepairStroke[],
  liveStroke: RepairStroke | null,
  viewport: EditorDocument["canvas"]["viewport"]
) {
  const visibleWidth = layer.crop.width * layer.transform.scaleX;
  const visibleHeight = layer.crop.height * layer.transform.scaleY;

  context.save();
  context.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.panX, viewport.panY);
  context.beginPath();
  context.rect(layer.transform.x, layer.transform.y, visibleWidth, visibleHeight);
  context.clip();

  strokes.forEach((stroke) => {
    drawRepairStroke(context, stroke);
  });

  if (liveStroke) {
    drawRepairStroke(context, liveStroke);
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 1.5;
  strokes.forEach((stroke) => {
    if (stroke.mode !== "paint" || stroke.points.length < 2) {
      return;
    }

    context.beginPath();
    stroke.points.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.stroke();
  });

  if (liveStroke?.mode === "paint" && liveStroke.points.length >= 2) {
    context.beginPath();
    liveStroke.points.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.stroke();
  }

  context.restore();
}

function drawSafeAreaOverlay(
  context: CanvasRenderingContext2D,
  document: EditorDocument,
  viewport: EditorDocument["canvas"]["viewport"],
  options?: { hideHint?: boolean }
): SafeAreaHintLayout | null {
  const inset =
    document.canvas.safeAreaInset > 0
      ? document.canvas.safeAreaInset
      : getDefaultSafeAreaInset(document.canvas.width, document.canvas.height);
  const safeX = inset;
  const safeY = inset;
  const safeWidth = Math.max(0, document.canvas.width - inset * 2);
  const safeHeight = Math.max(0, document.canvas.height - inset * 2);

  if (safeWidth <= 0 || safeHeight <= 0) {
    return null;
  }

  context.save();
  context.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.panX, viewport.panY);

  context.fillStyle = "rgba(34, 24, 18, 0.14)";
  context.beginPath();
  context.rect(0, 0, document.canvas.width, document.canvas.height);
  context.rect(safeX, safeY, safeWidth, safeHeight);
  context.fill("evenodd");

  context.strokeStyle = "rgba(255, 248, 238, 0.96)";
  context.lineWidth = 6;
  context.strokeRect(safeX, safeY, safeWidth, safeHeight);

  context.strokeStyle = "rgba(195, 111, 73, 0.98)";
  context.lineWidth = 2;
  context.setLineDash([18, 10]);
  context.strokeRect(safeX, safeY, safeWidth, safeHeight);

  if (options?.hideHint) {
    context.restore();
    return null;
  }

  const safeAreaHint = "重要内容请勿超出安全区，以免在不同投放尺寸或平台裁切时被遮挡或截断。";
  const hintPaddingX = 14;
  const hintPaddingY = 10;
  const hintOffset = 12;
  const closeButtonSize = 22;
  const closeButtonGap = 8;
  const maxHintWidth = Math.min(360, Math.max(180, safeWidth - hintOffset * 2 - hintPaddingX * 2));
  const hintLines: string[] = [];

  context.font = '600 16px "Segoe UI"';
  context.textBaseline = "top";

  let currentLine = "";
  for (const char of safeAreaHint) {
    const nextLine = `${currentLine}${char}`;
    if (currentLine && context.measureText(nextLine).width > maxHintWidth) {
      hintLines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = nextLine;
    }
  }
  if (currentLine) {
    hintLines.push(currentLine);
  }

  const visibleLines = hintLines.slice(0, 2);
  const lineHeight = 22;
  const textWidth = Math.max(...visibleLines.map((line) => context.measureText(line).width), 0);
  const hintBoxWidth = Math.min(
    safeWidth - hintOffset * 2,
    textWidth + hintPaddingX * 2 + closeButtonSize + closeButtonGap
  );
  const hintBoxHeight = visibleLines.length * lineHeight + hintPaddingY * 2;
  const hintX = safeX + hintOffset;
  const hintY = safeY + hintOffset;
  const closeButtonX = hintX + hintBoxWidth - hintPaddingX - closeButtonSize;
  const closeButtonY = hintY + hintPaddingY - 1;

  context.fillStyle = "rgba(255, 248, 238, 0.94)";
  context.fillRect(hintX, hintY, hintBoxWidth, hintBoxHeight);

  context.strokeStyle = "rgba(195, 111, 73, 0.28)";
  context.lineWidth = 1;
  context.setLineDash([]);
  context.strokeRect(hintX, hintY, hintBoxWidth, hintBoxHeight);

  context.fillStyle = "rgba(255, 248, 238, 0.98)";
  context.fillRect(closeButtonX, closeButtonY, closeButtonSize, closeButtonSize);

  context.strokeStyle = "rgba(195, 111, 73, 0.36)";
  context.strokeRect(closeButtonX, closeButtonY, closeButtonSize, closeButtonSize);

  context.fillStyle = "rgba(195, 111, 73, 0.94)";
  visibleLines.forEach((line, index) => {
    context.fillText(line, hintX + hintPaddingX, hintY + hintPaddingY + index * lineHeight);
  });

  context.font = '700 15px "Segoe UI"';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("×", closeButtonX + closeButtonSize / 2, closeButtonY + closeButtonSize / 2 + 0.5);
  context.restore();

  return {
    cardRect: { x: hintX, y: hintY, width: hintBoxWidth, height: hintBoxHeight },
    closeButtonRect: { x: closeButtonX, y: closeButtonY, width: closeButtonSize, height: closeButtonSize }
  };
}

export function CanvasViewport({
  activeTool,
  cropSession,
  repairSession,
  doodleStyle,
  document,
  selectedImageLayer,
  selectedLayerIds,
  onSelectionChange,
  onTextChange,
  onTransformChange,
  onViewportChange,
  onDoodleCommit,
  onRepairStrokeCommit,
  onCropSessionChange
}: CanvasViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const viewportShellRef = useRef<HTMLDivElement | null>(null);
  const canvasSurfaceRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<Canvas | null>(null);
  const suppressSyncRef = useRef(false);
  const safeAreaHintLayoutRef = useRef<SafeAreaHintLayout | null>(null);
  const pendingAutoViewportRef = useRef<DocumentCanvasViewport | null>(null);
  const activeToolRef = useRef(activeTool);
  const documentRef = useRef(document);
  const selectedImageLayerRef = useRef(selectedImageLayer);
  const cropSessionRef = useRef(cropSession);
  const repairSessionRef = useRef(repairSession);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onTextChangeRef = useRef(onTextChange);
  const onTransformChangeRef = useRef(onTransformChange);
  const onViewportChangeRef = useRef(onViewportChange);
  const onDoodleCommitRef = useRef(onDoodleCommit);
  const onRepairStrokeCommitRef = useRef(onRepairStrokeCommit);
  const onCropSessionChangeRef = useRef(onCropSessionChange);
  const panSessionRef = useRef({ isPanning: false, lastX: 0, lastY: 0 });
  const drawSessionRef = useRef({ mode: null as "doodle" | "crop" | "repair" | null });
  const doodlePointsRef = useRef<DoodlePoint[]>([]);
  const cropHoverHandleRef = useRef<CropHandle>(null);
  const cropDragRef = useRef<{ handle: CropHandle; startPoint: DoodlePoint; startCrop: ImageCrop | null }>({
    handle: null,
    startPoint: { x: 0, y: 0 },
    startCrop: null
  });
  const [isSafeAreaHintDismissed, setIsSafeAreaHintDismissed] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const canvasSurfaceStyle: CSSProperties = {
    width: document.canvas.width,
    height: document.canvas.height,
    ...getCanvasSurfaceStyle(document)
  };

  const updateOverlayCursor = useCallback((handle: CropHandle = null) => {
    const overlay = overlayRef.current;

    if (!overlay) {
      return;
    }

    if (activeToolRef.current === "crop") {
      overlay.style.cursor = getCursorForCropHandle(handle);
      return;
    }

    overlay.style.cursor = resolveCanvasCursor(activeToolRef.current, panSessionRef.current.isPanning);
  }, []);

  const resolveActiveCropHandle = useCallback((docPoint: DoodlePoint) => {
    const currentSelectedImageLayer = selectedImageLayerRef.current;
    const currentCropSession = cropSessionRef.current;

    if (
      activeToolRef.current !== "crop" ||
      !currentSelectedImageLayer ||
      !currentCropSession ||
      currentCropSession.layerId !== currentSelectedImageLayer.id
    ) {
      return null;
    }

    return resolveCropHandle(docPoint, getCropPreviewBounds(currentSelectedImageLayer, currentCropSession.draft));
  }, []);

  const startCropDrag = useCallback((docPoint: DoodlePoint) => {
    const currentCropSession = cropSessionRef.current;
    const handle = resolveActiveCropHandle(docPoint);

    if (!currentCropSession || !handle) {
      return false;
    }

    drawSessionRef.current.mode = "crop";
    cropDragRef.current = { handle, startPoint: docPoint, startCrop: currentCropSession.draft };
    cropHoverHandleRef.current = handle;
    updateOverlayCursor(handle);
    return true;
  }, [resolveActiveCropHandle, updateOverlayCursor]);

  const updateCropDrag = useCallback((docPoint: DoodlePoint) => {
    const currentSelectedImageLayer = selectedImageLayerRef.current;
    const activeDrag = cropDragRef.current;

    if (
      drawSessionRef.current.mode !== "crop" ||
      activeToolRef.current !== "crop" ||
      !currentSelectedImageLayer ||
      !activeDrag.handle ||
      !activeDrag.startCrop
    ) {
      return false;
    }

    onCropSessionChangeRef.current(
      computeCropDraftFromPointer(
        currentSelectedImageLayer,
        activeDrag.handle,
        activeDrag.startPoint,
        docPoint,
        activeDrag.startCrop
      )
    );
    return true;
  }, []);

  const refreshCropHoverCursor = useCallback((docPoint: DoodlePoint) => {
    const handle = resolveActiveCropHandle(docPoint);
    cropHoverHandleRef.current = handle;
    updateOverlayCursor(handle);
  }, [resolveActiveCropHandle, updateOverlayCursor]);

  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const pointer = { x: event.clientX, y: event.clientY };
    const currentDocument = documentRef.current;
    const rect = overlayRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const docPoint = mapClientPointToDocument(pointer.x, pointer.y, rect, currentDocument.canvas.viewport);

    if (isPointInDocumentRect(docPoint, safeAreaHintLayoutRef.current?.closeButtonRect ?? null)) {
      setIsSafeAreaHintDismissed(true);
      event.stopPropagation();
      return;
    }
  }, []);

  const handleOverlayMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const pointer = getPointerClientPosition(event.nativeEvent);
    const currentDocument = documentRef.current;
    const rect = overlayRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const docPoint = mapClientPointToDocument(pointer.x, pointer.y, rect, currentDocument.canvas.viewport);

    if (isPointInDocumentRect(docPoint, safeAreaHintLayoutRef.current?.closeButtonRect ?? null)) {
      setIsSafeAreaHintDismissed(true);
      event.stopPropagation();
      return;
    }

    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const currentTool = activeToolRef.current;
    const currentSelectedImageLayer = selectedImageLayerRef.current;

    if (currentTool === "doodle") {
      drawSessionRef.current.mode = "doodle";
      doodlePointsRef.current = [docPoint];
      renderOverlay();
      return;
    }

    if (
      currentTool === "repair" &&
      currentSelectedImageLayer &&
      repairSessionRef.current &&
      repairSessionRef.current.layerId === currentSelectedImageLayer.id &&
      !repairSessionRef.current.isSubmitting
    ) {
      drawSessionRef.current.mode = "repair";
      doodlePointsRef.current = [docPoint];
      renderOverlay();
      return;
    }

    if (
      currentTool === "crop" &&
      currentSelectedImageLayer &&
      cropSessionRef.current &&
      cropSessionRef.current.layerId === currentSelectedImageLayer.id
    ) {
      startCropDrag(docPoint);
    }
  }, [startCropDrag]);

  const handleOverlayMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const pointer = getPointerClientPosition(event.nativeEvent);
    const currentDocument = documentRef.current;
    const rect = overlayRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const docPoint = mapClientPointToDocument(pointer.x, pointer.y, rect, currentDocument.canvas.viewport);

    if (drawSessionRef.current.mode === "doodle" && activeToolRef.current === "doodle") {
      doodlePointsRef.current = [...doodlePointsRef.current, docPoint];
      renderOverlay();
      return;
    }

    if (drawSessionRef.current.mode === "repair" && activeToolRef.current === "repair") {
      doodlePointsRef.current = [...doodlePointsRef.current, docPoint];
      renderOverlay();
      return;
    }

    if (updateCropDrag(docPoint)) {
      return;
    }

    if (activeToolRef.current === "crop") {
      refreshCropHoverCursor(docPoint);
    }
  }, [refreshCropHoverCursor, updateCropDrag]);

  const handleOverlayMouseUp = useCallback(() => {
    if (panSessionRef.current.isPanning) {
      panSessionRef.current.isPanning = false;
      const runtime = runtimeRef.current;
      if (runtime) {
        const viewportTransform = runtime.viewportTransform ?? [1, 0, 0, 1, 0, 0];
        onViewportChangeRef.current({ zoom: viewportTransform[0] ?? 1, panX: viewportTransform[4] ?? 0, panY: viewportTransform[5] ?? 0 });
      }
    }

    if (drawSessionRef.current.mode === "doodle" && doodlePointsRef.current.length > 1) {
      onDoodleCommitRef.current(doodlePointsRef.current);
    }

    if (drawSessionRef.current.mode === "repair" && doodlePointsRef.current.length > 0) {
      onRepairStrokeCommitRef.current(doodlePointsRef.current);
    }

    drawSessionRef.current.mode = null;
    doodlePointsRef.current = [];
    cropDragRef.current = { handle: null, startPoint: { x: 0, y: 0 }, startCrop: null };
    cropHoverHandleRef.current = null;
    updateOverlayCursor(null);
    renderOverlay();
  }, [updateOverlayCursor]);

  const handleOverlayTouchStart = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length > 0) {
      const mouseEvent = new MouseEvent("mousedown", {
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY
      });
      handleOverlayMouseDown(mouseEvent as any);
    }
  }, []);

  const handleOverlayTouchMove = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length > 0) {
      const mouseEvent = new MouseEvent("mousemove", {
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY
      });
      handleOverlayMouseMove(mouseEvent as any);
    }
  }, []);

  const handleOverlayTouchEnd = useCallback(() => {
    handleOverlayMouseUp();
  }, []);

  const renderOverlay = (viewport?: EditorDocument["canvas"]["viewport"]) => {
    const overlay = overlayRef.current;

    if (!overlay) {
      return;
    }

    const context = overlay.getContext("2d");

    if (!context) {
      return;
    }

    const effectiveViewport = viewport ?? documentRef.current.canvas.viewport;

    context.clearRect(0, 0, overlay.width, overlay.height);
    safeAreaHintLayoutRef.current = drawSafeAreaOverlay(context, documentRef.current, effectiveViewport, {
      hideHint: isSafeAreaHintDismissed
    });

    if (activeToolRef.current === "doodle") {
      drawDoodlePreview(context, doodlePointsRef.current, effectiveViewport, doodleStyle);
    }

    if (
      activeToolRef.current === "repair" &&
      repairSessionRef.current &&
      selectedImageLayerRef.current &&
      repairSessionRef.current.layerId === selectedImageLayerRef.current.id &&
      repairSessionRef.current.guidePreviewEnabled
    ) {
      const liveStroke = drawSessionRef.current.mode === "repair" && doodlePointsRef.current.length > 0
        ? {
            points: doodlePointsRef.current,
            brushSize: repairSessionRef.current.brushSize,
            mode: (repairSessionRef.current.toolMode === "eraser" ? "erase" : "paint") as RepairStroke["mode"]
          }
        : null;
      drawRepairOverlay(
        context,
        selectedImageLayerRef.current,
        repairSessionRef.current.strokes,
        liveStroke,
        effectiveViewport
      );
    }

    if (
      activeToolRef.current === "crop" &&
      cropSessionRef.current &&
      selectedImageLayerRef.current &&
      cropSessionRef.current.layerId === selectedImageLayerRef.current.id
    ) {
      drawCropOverlay(context, selectedImageLayerRef.current, cropSessionRef.current.draft, effectiveViewport);
    }
  };

  useEffect(() => {
    activeToolRef.current = activeTool;
    documentRef.current = document;
    selectedImageLayerRef.current = selectedImageLayer;
    cropSessionRef.current = cropSession;
    repairSessionRef.current = repairSession;
    onSelectionChangeRef.current = onSelectionChange;
    onTextChangeRef.current = onTextChange;
    onTransformChangeRef.current = onTransformChange;
    onViewportChangeRef.current = onViewportChange;
    onDoodleCommitRef.current = onDoodleCommit;
    onRepairStrokeCommitRef.current = onRepairStrokeCommit;
    onCropSessionChangeRef.current = onCropSessionChange;
    updateOverlayCursor(cropHoverHandleRef.current);
    renderOverlay();
  }, [
    activeTool,
    cropSession,
    repairSession,
    document,
    onCropSessionChange,
    onDoodleCommit,
    onSelectionChange,
    onTextChange,
    onTransformChange,
    onViewportChange,
    selectedImageLayer,
    updateOverlayCursor
  ]);

  useEffect(() => {
    const shell = viewportShellRef.current;
    const surface = canvasSurfaceRef.current;

    if (!shell) {
      return;
    }

    const updateBounds = () => {
      const shellStyle = window.getComputedStyle(shell);
      const shellPaddingX = Number.parseFloat(shellStyle.paddingLeft) + Number.parseFloat(shellStyle.paddingRight);
      const shellPaddingY = Number.parseFloat(shellStyle.paddingTop) + Number.parseFloat(shellStyle.paddingBottom);
      const surfaceStyle = surface ? window.getComputedStyle(surface) : null;
      const surfacePaddingX = surfaceStyle
        ? Number.parseFloat(surfaceStyle.paddingLeft) + Number.parseFloat(surfaceStyle.paddingRight)
        : 0;
      const surfacePaddingY = surfaceStyle
        ? Number.parseFloat(surfaceStyle.paddingTop) + Number.parseFloat(surfaceStyle.paddingBottom)
        : 0;
      const nextWidth = Math.max(1, shell.clientWidth - shellPaddingX - surfacePaddingX);
      const nextHeight = Math.max(1, shell.clientHeight - shellPaddingY - surfacePaddingY);

      setViewportBounds((current) => {
        if (current && current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    updateBounds();

    const observer = new ResizeObserver(() => {
      updateBounds();
    });

    observer.observe(shell);
    if (surface) {
      observer.observe(surface);
    }

    return () => {
      observer.disconnect();
    };
  }, [document.canvas.height, document.canvas.width]);

  useEffect(() => {
    if (!viewportBounds || !isDefaultCanvasViewport(document.canvas.viewport)) {
      return;
    }

    const nextViewport = calculateCenteredViewport(document, viewportBounds);

    if (isSameViewport(document.canvas.viewport, nextViewport) || isSameViewport(pendingAutoViewportRef.current, nextViewport)) {
      return;
    }

    pendingAutoViewportRef.current = nextViewport;
    onViewportChangeRef.current(nextViewport);
  }, [
    document,
    document.canvas.height,
    document.canvas.viewport,
    document.canvas.width,
    viewportBounds
  ]);

  useEffect(() => {
    if (pendingAutoViewportRef.current && isSameViewport(document.canvas.viewport, pendingAutoViewportRef.current)) {
      pendingAutoViewportRef.current = null;
      return;
    }

    if (!isDefaultCanvasViewport(document.canvas.viewport)) {
      pendingAutoViewportRef.current = null;
    }
  }, [document.canvas.viewport]);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const runtime = new Canvas(canvasRef.current, {
      width: document.canvas.width,
      height: document.canvas.height,
      backgroundColor: "transparent",
      preserveObjectStacking: true,
      selection: true
    });

    runtimeRef.current = runtime;
    applyViewport(runtime, document.canvas.viewport.zoom, document.canvas.viewport.panX, document.canvas.viewport.panY);

    const syncSelection = () => {
      if (suppressSyncRef.current || ["crop", "doodle", "repair"].includes(activeToolRef.current)) {
        return;
      }

      const activeObject = runtime.getActiveObject();
      const layerId = getLayerId(activeObject);
      onSelectionChangeRef.current(layerId ? [layerId] : []);
    };

    const syncTransform = (target: unknown) => {
      if (suppressSyncRef.current) {
        return;
      }

      const layerId = getLayerId(target);

      if (!layerId) {
        return;
      }

      const object = target as LayerCanvasObject;
      onTransformChangeRef.current(layerId, {
        x: Math.round(object.left ?? 0),
        y: Math.round(object.top ?? 0),
        scaleX: Number((object.scaleX ?? 1).toFixed(3)),
        scaleY: Number((object.scaleY ?? 1).toFixed(3)),
        rotation: Math.round(object.angle ?? 0),
        flipX: Boolean(object.flipX),
        flipY: Boolean(object.flipY)
      });
    };

    const commitTextChange = (target: unknown) => {
      const object = target as LayerCanvasObject | undefined;
      const layerId = getLayerId(object);

      if (layerId && typeof object?.text === "string") {
        onTextChangeRef.current(layerId, object.text);
      }
    };

    const handleMouseDown = (event: { e: MouseEvent | TouchEvent; target?: unknown }) => {
      const pointer = getPointerClientPosition(event.e);
      const currentTool = activeToolRef.current;
      const currentDocument = documentRef.current;
      const currentSelectedImageLayer = selectedImageLayerRef.current;
      const rect = overlayRef.current?.getBoundingClientRect();
      const targetLayerId = getLayerId(event.target);

      if (!rect) {
        return;
      }

      const docPoint = mapClientPointToDocument(pointer.x, pointer.y, rect, currentDocument.canvas.viewport);

      if (isPointInDocumentRect(docPoint, safeAreaHintLayoutRef.current?.closeButtonRect ?? null)) {
        setIsSafeAreaHintDismissed(true);
        event.e.stopPropagation();
        return;
      }

      if (currentTool === "select" && !targetLayerId) {
        panSessionRef.current = { isPanning: true, lastX: pointer.x, lastY: pointer.y };
        syncCanvasInteractionMode(runtime, currentDocument, currentTool, true);
        runtime.discardActiveObject();
        runtime.requestRenderAll();
        return;
      }

      if (currentTool === "doodle") {
        drawSessionRef.current.mode = "doodle";
        doodlePointsRef.current = [docPoint];
        renderOverlay();
        return;
      }

      if (
        currentTool === "repair" &&
        currentSelectedImageLayer &&
        repairSessionRef.current &&
        repairSessionRef.current.layerId === currentSelectedImageLayer.id &&
        !repairSessionRef.current.isSubmitting
      ) {
        drawSessionRef.current.mode = "repair";
        doodlePointsRef.current = [docPoint];
        renderOverlay();
        return;
      }

      if (
        currentTool === "crop" &&
        currentSelectedImageLayer &&
        cropSessionRef.current &&
        cropSessionRef.current.layerId === currentSelectedImageLayer.id
      ) {
        if (!startCropDrag(docPoint)) {
          return;
        }
      }
    };

    const handleMouseMove = (event: { e: MouseEvent | TouchEvent }) => {
      const pointer = getPointerClientPosition(event.e);
      const currentTool = activeToolRef.current;
      const currentDocument = documentRef.current;
      const currentSelectedImageLayer = selectedImageLayerRef.current;
      const rect = overlayRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const docPoint = mapClientPointToDocument(pointer.x, pointer.y, rect, currentDocument.canvas.viewport);

      if (panSessionRef.current.isPanning) {
        const deltaX = pointer.x - panSessionRef.current.lastX;
        const deltaY = pointer.y - panSessionRef.current.lastY;
        const viewportTransform = runtime.viewportTransform ?? [1, 0, 0, 1, 0, 0];
        const nextZoom = viewportTransform[0] ?? 1;
        const nextPanX = (viewportTransform[4] ?? 0) + deltaX;
        const nextPanY = (viewportTransform[5] ?? 0) + deltaY;

        const shell = viewportShellRef.current;
        const clampedPan = shell
          ? clampPan(
              nextPanX,
              nextPanY,
              nextZoom,
              documentRef.current.canvas.width,
              documentRef.current.canvas.height,
              shell.clientWidth,
              shell.clientHeight
            )
          : { panX: nextPanX, panY: nextPanY };

        panSessionRef.current.lastX = pointer.x;
        panSessionRef.current.lastY = pointer.y;
        applyViewport(runtime, nextZoom, clampedPan.panX, clampedPan.panY);
        renderOverlay({ zoom: nextZoom, panX: clampedPan.panX, panY: clampedPan.panY });
        return;
      }

      if (drawSessionRef.current.mode === "doodle" && currentTool === "doodle") {
        doodlePointsRef.current = [...doodlePointsRef.current, docPoint];
        renderOverlay();
        return;
      }

      if (drawSessionRef.current.mode === "repair" && currentTool === "repair") {
        doodlePointsRef.current = [...doodlePointsRef.current, docPoint];
        renderOverlay();
        return;
      }

      if (updateCropDrag(docPoint)) {
        return;
      }

      if (currentTool === "crop") {
        refreshCropHoverCursor(docPoint);
      }
    };

    const handleMouseWheel = (event: { e: WheelEvent }) => {
      const hasModifier = event.e.ctrlKey || event.e.metaKey;

      if (!hasModifier) {
        return;
      }

      const rect = overlayRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      event.e.preventDefault();
      const viewport = documentRef.current.canvas.viewport;
      const pointerX = event.e.clientX - rect.left;
      const pointerY = event.e.clientY - rect.top;
      const focusX = (pointerX - viewport.panX) / viewport.zoom;
      const focusY = (pointerY - viewport.panY) / viewport.zoom;
      const nextZoom = clampZoom(viewport.zoom * Math.exp(-event.e.deltaY * 0.0022));

      if (Math.abs(nextZoom - viewport.zoom) < 0.0001) {
        return;
      }

      const nextPanX = pointerX - focusX * nextZoom;
      const nextPanY = pointerY - focusY * nextZoom;

      const shell = viewportShellRef.current;
      const clampedPan = shell
        ? clampPan(
            nextPanX,
            nextPanY,
            nextZoom,
            documentRef.current.canvas.width,
            documentRef.current.canvas.height,
            shell.clientWidth,
            shell.clientHeight
          )
        : { panX: nextPanX, panY: nextPanY };

      applyViewport(runtime, nextZoom, clampedPan.panX, clampedPan.panY);
      onViewportChangeRef.current({ zoom: Number(nextZoom.toFixed(3)), panX: Math.round(clampedPan.panX), panY: Math.round(clampedPan.panY) });
      renderOverlay();
    };

    const stopInteraction = () => {
      if (panSessionRef.current.isPanning) {
        panSessionRef.current.isPanning = false;
        const viewportTransform = runtime.viewportTransform ?? [1, 0, 0, 1, 0, 0];
        onViewportChangeRef.current({ zoom: viewportTransform[0] ?? 1, panX: viewportTransform[4] ?? 0, panY: viewportTransform[5] ?? 0 });
        syncCanvasInteractionMode(runtime, documentRef.current, activeToolRef.current);
      }

      if (drawSessionRef.current.mode === "doodle" && doodlePointsRef.current.length > 1) {
        onDoodleCommitRef.current(doodlePointsRef.current);
      }

      if (drawSessionRef.current.mode === "repair" && doodlePointsRef.current.length > 0) {
        onRepairStrokeCommitRef.current(doodlePointsRef.current);
      }

      drawSessionRef.current.mode = null;
      doodlePointsRef.current = [];
      cropDragRef.current = { handle: null, startPoint: { x: 0, y: 0 }, startCrop: null };
      cropHoverHandleRef.current = null;
      updateOverlayCursor(null);
      renderOverlay();
    };

    runtime.on("selection:created", syncSelection);
    runtime.on("selection:updated", syncSelection);
    runtime.on("selection:cleared", syncSelection);
    runtime.on("object:modified", (event: { target?: unknown }) => syncTransform(event.target));
    runtime.on("text:editing:exited", (event: { target?: unknown }) => commitTextChange(event.target));
    runtime.on("mouse:down", handleMouseDown);
    runtime.on("mouse:move", handleMouseMove);
    runtime.on("mouse:up", stopInteraction);
    runtime.on("mouse:wheel", handleMouseWheel);

    const handleGlobalMouseUp = () => {
      stopInteraction();
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [
    document.canvas.backgroundColor,
    document.canvas.height,
    document.canvas.width,
    refreshCropHoverCursor,
    startCropDrag,
    updateCropDrag,
    updateOverlayCursor
  ]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    drawSessionRef.current.mode = null;
    doodlePointsRef.current = [];

    const directManipulation = isDirectManipulationTool(activeTool);
    syncCanvasInteractionMode(runtime, documentRef.current, activeTool);
    cropHoverHandleRef.current = null;
    updateOverlayCursor(null);

    if (directManipulation) {
      runtime.discardActiveObject();
      runtime.requestRenderAll();
    }
  }, [activeTool, updateOverlayCursor]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    applyViewport(runtime, document.canvas.viewport.zoom, document.canvas.viewport.panX, document.canvas.viewport.panY);
    renderOverlay();
  }, [document.canvas.viewport.panX, document.canvas.viewport.panY, document.canvas.viewport.zoom]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    let cancelled = false;

    const render = async () => {
      suppressSyncRef.current = true;
      await seedCanvas(runtime, document, selectedLayerIds, {
        cropPreview: cropSession,
        showSafeArea: false,
        renderCanvasBackground: false
      });

      if (cancelled) {
        return;
      }

      applyViewport(runtime, document.canvas.viewport.zoom, document.canvas.viewport.panX, document.canvas.viewport.panY);
      syncCanvasInteractionMode(runtime, document, activeToolRef.current);
      suppressSyncRef.current = false;
      renderOverlay();
    };

    void render();

    return () => {
      cancelled = true;
      suppressSyncRef.current = false;
    };
  }, [cropSession, document, doodleStyle, repairSession, selectedLayerIds]);

  useEffect(() => {
    renderOverlay();
  }, [isSafeAreaHintDismissed]);

  return (
    <div ref={viewportShellRef} className="workspace__viewport-shell">
      <div className="workspace__viewport-inner">
        <div className="workspace__viewport-board">
          <div ref={canvasSurfaceRef} className="workspace__canvas-surface">
            <div className="workspace__canvas-stack" style={canvasSurfaceStyle}>
              <canvas ref={canvasRef} className="workspace__canvas" height={document.canvas.height} width={document.canvas.width} />
              <canvas
                ref={overlayRef}
                className={`workspace__mask-overlay ${["doodle", "crop", "repair"].includes(activeTool) ? "workspace__mask-overlay--interactive" : ""}`}
                height={document.canvas.height}
                onClick={handleOverlayClick}
                onMouseDown={handleOverlayMouseDown}
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={handleOverlayMouseUp}
                onTouchStart={handleOverlayTouchStart}
                onTouchMove={handleOverlayTouchMove}
                onTouchEnd={handleOverlayTouchEnd}
                width={document.canvas.width}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
