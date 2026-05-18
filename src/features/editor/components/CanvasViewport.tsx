import { Canvas } from "fabric";
import { useEffect, useRef, type CSSProperties } from "react";
import type {
  CanvasBackgroundMode,
  DoodlePoint,
  EditorDocument,
  EditorTool,
  ImageCrop,
  ImageLayer,
  MaskPoint
} from "../model/document";
import { seedCanvas } from "../runtime/seedCanvas";

type CropSession = {
  layerId: string;
  draft: ImageCrop;
} | null;

type CanvasViewportProps = {
  activeTool: EditorTool;
  cropSession: CropSession;
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
  onMaskStart: (layerId: string, mode: "paint" | "erase", point: MaskPoint) => void;
  onMaskAppend: (layerId: string, point: MaskPoint) => void;
  onMaskFinish: (layerId: string) => void;
  onDoodleCommit: (points: DoodlePoint[]) => void;
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
  data?: {
    layerId?: string;
  };
  text?: string;
  isEditing?: boolean;
};

type CropHandle = "move" | "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se" | null;

function getLayerId(target: unknown) {
  return (target as LayerCanvasObject | undefined)?.data?.layerId ?? null;
}

function applyViewport(runtime: Canvas, zoom: number, panX: number, panY: number) {
  runtime.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
  runtime.requestRenderAll();
}

function clampZoom(zoom: number) {
  return Math.min(3, Math.max(0.2, zoom));
}

function isDirectManipulationTool(activeTool: EditorTool) {
  return ["brush", "eraser", "crop", "doodle"].includes(activeTool);
}

function syncCanvasInteractionMode(runtime: Canvas, activeTool: EditorTool, isPanning = false) {
  const directManipulation = isDirectManipulationTool(activeTool);

  runtime.selection = !directManipulation && !isPanning;
  runtime.defaultCursor = directManipulation
    ? "crosshair"
    : isPanning
      ? "grabbing"
      : "default";
  runtime.hoverCursor = runtime.defaultCursor;
}

function getCanvasSurfaceStyle(document: EditorDocument): CSSProperties {
  const background = document.canvas.displayBackground ?? {
    mode: "grid" as CanvasBackgroundMode,
    color: document.canvas.backgroundColor
  };

  if (background.mode === "solid") {
    return {
      backgroundColor: background.color,
      backgroundImage: "none"
    };
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
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
  }

  if ("changedTouches" in event && event.changedTouches.length > 0) {
    return {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY
    };
  }

  return {
    x: (event as MouseEvent).clientX,
    y: (event as MouseEvent).clientY
  };
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

function mapDocumentPointToImage(docPoint: { x: number; y: number }, layer: ImageLayer) {
  const width = layer.crop.width * layer.transform.scaleX;
  const height = layer.crop.height * layer.transform.scaleY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const normalizedX = (docPoint.x - layer.transform.x) / width;
  const normalizedY = (docPoint.y - layer.transform.y) / height;

  if (normalizedX < 0 || normalizedY < 0 || normalizedX > 1 || normalizedY > 1) {
    return null;
  }

  return {
    x: normalizedX,
    y: normalizedY
  } satisfies MaskPoint;
}

function getCropPreviewBounds(layer: ImageLayer, crop: ImageCrop) {
  return {
    imageX: layer.transform.x,
    imageY: layer.transform.y,
    imageWidth: layer.originalWidth * layer.transform.scaleX,
    imageHeight: layer.originalHeight * layer.transform.scaleY,
    cropX: layer.transform.x + crop.x * layer.transform.scaleX,
    cropY: layer.transform.y + crop.y * layer.transform.scaleY,
    cropWidth: crop.width * layer.transform.scaleX,
    cropHeight: crop.height * layer.transform.scaleY
  };
}

function resolveCropHandle(
  docPoint: DoodlePoint,
  bounds: ReturnType<typeof getCropPreviewBounds>
): CropHandle {
  const edgeTolerance = 12;
  const cornerTolerance = 14;
  const withinX = docPoint.x >= bounds.cropX && docPoint.x <= bounds.cropX + bounds.cropWidth;
  const withinY = docPoint.y >= bounds.cropY && docPoint.y <= bounds.cropY + bounds.cropHeight;
  const nearLeft = Math.abs(docPoint.x - bounds.cropX) <= edgeTolerance;
  const nearRight = Math.abs(docPoint.x - (bounds.cropX + bounds.cropWidth)) <= edgeTolerance;
  const nearTop = Math.abs(docPoint.y - bounds.cropY) <= edgeTolerance;
  const nearBottom = Math.abs(docPoint.y - (bounds.cropY + bounds.cropHeight)) <= edgeTolerance;

  if (nearLeft && nearTop) {
    return "nw";
  }

  if (nearRight && nearTop) {
    return "ne";
  }

  if (nearLeft && nearBottom) {
    return "sw";
  }

  if (nearRight && nearBottom) {
    return "se";
  }

  if (withinX && nearTop) {
    return "n";
  }

  if (withinX && nearBottom) {
    return "s";
  }

  if (withinY && nearLeft) {
    return "w";
  }

  if (withinY && nearRight) {
    return "e";
  }

  if (
    withinX &&
    withinY &&
    docPoint.x >= bounds.cropX + cornerTolerance &&
    docPoint.x <= bounds.cropX + bounds.cropWidth - cornerTolerance &&
    docPoint.y >= bounds.cropY + cornerTolerance &&
    docPoint.y <= bounds.cropY + bounds.cropHeight - cornerTolerance
  ) {
    return "move";
  }

  return null;
}

function drawMaskOverlay(
  context: CanvasRenderingContext2D,
  layer: ImageLayer,
  viewport: EditorDocument["canvas"]["viewport"]
) {
  if (!layer.mask.showPreview) {
    return;
  }

  context.save();
  context.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.panX, viewport.panY);

  for (const stroke of layer.mask.strokes) {
    if (stroke.points.length === 0) {
      continue;
    }

    context.beginPath();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle =
      stroke.mode === "paint" ? "rgba(205, 92, 45, 0.38)" : "rgba(255, 255, 255, 0.82)";
    context.lineWidth = stroke.size * layer.transform.scaleX;

    stroke.points.forEach((point, index) => {
      const x = layer.transform.x + point.x * layer.crop.width * layer.transform.scaleX;
      const y = layer.transform.y + point.y * layer.crop.height * layer.transform.scaleY;

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.stroke();
  }

  context.restore();
}

function drawDoodlePreview(
  context: CanvasRenderingContext2D,
  points: DoodlePoint[],
  viewport: EditorDocument["canvas"]["viewport"]
) {
  if (points.length < 2) {
    return;
  }

  context.save();
  context.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.panX, viewport.panY);
  context.beginPath();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#cd5c2d";
  context.lineWidth = 14;

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
  const handleLength = 18;
  const handleThickness = 6;

  context.save();
  context.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.panX, viewport.panY);

  context.fillStyle = "rgba(28, 37, 32, 0.28)";
  context.fillRect(bounds.imageX, bounds.imageY, bounds.imageWidth, bounds.imageHeight);
  context.clearRect(bounds.cropX, bounds.cropY, bounds.cropWidth, bounds.cropHeight);

  context.strokeStyle = "#cd5c2d";
  context.lineWidth = 2;
  context.strokeRect(bounds.cropX, bounds.cropY, bounds.cropWidth, bounds.cropHeight);

  const handles = [
    {
      x: bounds.cropX,
      y: bounds.cropY,
      width: handleLength,
      height: handleThickness,
      rotation: 45
    },
    {
      x: bounds.cropX + bounds.cropWidth,
      y: bounds.cropY,
      width: handleLength,
      height: handleThickness,
      rotation: -45
    },
    {
      x: bounds.cropX,
      y: bounds.cropY + bounds.cropHeight,
      width: handleLength,
      height: handleThickness,
      rotation: -45
    },
    {
      x: bounds.cropX + bounds.cropWidth,
      y: bounds.cropY + bounds.cropHeight,
      width: handleLength,
      height: handleThickness,
      rotation: 45
    },
    {
      x: bounds.cropX + bounds.cropWidth / 2,
      y: bounds.cropY,
      width: handleLength,
      height: handleThickness,
      rotation: 0
    },
    {
      x: bounds.cropX + bounds.cropWidth / 2,
      y: bounds.cropY + bounds.cropHeight,
      width: handleLength,
      height: handleThickness,
      rotation: 0
    },
    {
      x: bounds.cropX,
      y: bounds.cropY + bounds.cropHeight / 2,
      width: handleThickness,
      height: handleLength,
      rotation: 0
    },
    {
      x: bounds.cropX + bounds.cropWidth,
      y: bounds.cropY + bounds.cropHeight / 2,
      width: handleThickness,
      height: handleLength,
      rotation: 0
    }
  ];

  context.fillStyle = "#fffaf3";
  handles.forEach((handle) => {
    context.save();
    context.translate(handle.x, handle.y);
    context.rotate((handle.rotation * Math.PI) / 180);
    context.beginPath();
    context.rect(-handle.width / 2, -handle.height / 2, handle.width, handle.height);
    context.fill();
    context.stroke();
    context.restore();
  });

  context.restore();
}

export function CanvasViewport({
  activeTool,
  cropSession,
  document,
  selectedImageLayer,
  selectedLayerIds,
  onSelectionChange,
  onTextChange,
  onTransformChange,
  onViewportChange,
  onMaskStart,
  onMaskAppend,
  onMaskFinish,
  onDoodleCommit,
  onCropSessionChange
}: CanvasViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<Canvas | null>(null);
  const suppressSyncRef = useRef(false);
  const activeToolRef = useRef(activeTool);
  const documentRef = useRef(document);
  const selectedImageLayerRef = useRef(selectedImageLayer);
  const cropSessionRef = useRef(cropSession);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onTextChangeRef = useRef(onTextChange);
  const onTransformChangeRef = useRef(onTransformChange);
  const onViewportChangeRef = useRef(onViewportChange);
  const onMaskStartRef = useRef(onMaskStart);
  const onMaskAppendRef = useRef(onMaskAppend);
  const onMaskFinishRef = useRef(onMaskFinish);
  const onDoodleCommitRef = useRef(onDoodleCommit);
  const onCropSessionChangeRef = useRef(onCropSessionChange);
  const panSessionRef = useRef({
    isPanning: false,
    lastX: 0,
    lastY: 0
  });
  const drawSessionRef = useRef({
    mode: null as "mask" | "doodle" | "crop" | null
  });
  const doodlePointsRef = useRef<DoodlePoint[]>([]);
  const cropDragRef = useRef<{
    handle: CropHandle;
    startPoint: DoodlePoint;
    startCrop: ImageCrop | null;
  }>({
    handle: null,
    startPoint: { x: 0, y: 0 },
    startCrop: null
  });
  const canvasSurfaceStyle: CSSProperties = {
    width: document.canvas.width,
    height: document.canvas.height,
    ...getCanvasSurfaceStyle(document)
  };

  const renderOverlay = () => {
    const overlay = overlayRef.current;

    if (!overlay) {
      return;
    }

    const context = overlay.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, overlay.width, overlay.height);

    if (
      (activeToolRef.current === "brush" || activeToolRef.current === "eraser") &&
      selectedImageLayerRef.current
    ) {
      drawMaskOverlay(context, selectedImageLayerRef.current, documentRef.current.canvas.viewport);
    }

    if (activeToolRef.current === "doodle") {
      drawDoodlePreview(context, doodlePointsRef.current, documentRef.current.canvas.viewport);
    }

    if (
      activeToolRef.current === "crop" &&
      cropSessionRef.current &&
      selectedImageLayerRef.current &&
      cropSessionRef.current.layerId === selectedImageLayerRef.current.id
    ) {
      drawCropOverlay(
        context,
        selectedImageLayerRef.current,
        cropSessionRef.current.draft,
        documentRef.current.canvas.viewport
      );
    }
  };

  useEffect(() => {
    activeToolRef.current = activeTool;
    documentRef.current = document;
    selectedImageLayerRef.current = selectedImageLayer;
    cropSessionRef.current = cropSession;
    onSelectionChangeRef.current = onSelectionChange;
    onTextChangeRef.current = onTextChange;
    onTransformChangeRef.current = onTransformChange;
    onViewportChangeRef.current = onViewportChange;
    onMaskStartRef.current = onMaskStart;
    onMaskAppendRef.current = onMaskAppend;
    onMaskFinishRef.current = onMaskFinish;
    onDoodleCommitRef.current = onDoodleCommit;
    onCropSessionChangeRef.current = onCropSessionChange;
    renderOverlay();
  }, [
    activeTool,
    cropSession,
    document,
    onCropSessionChange,
    onDoodleCommit,
    onMaskAppend,
    onMaskFinish,
    onMaskStart,
    onSelectionChange,
    onTextChange,
    onTransformChange,
    onViewportChange,
    selectedImageLayer
  ]);

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
    applyViewport(
      runtime,
      document.canvas.viewport.zoom,
      document.canvas.viewport.panX,
      document.canvas.viewport.panY
    );

    const syncSelection = () => {
      if (
        suppressSyncRef.current ||
        ["brush", "eraser", "crop", "doodle"].includes(activeToolRef.current)
      ) {
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

    const handleObjectModified = (event: { target?: unknown }) => {
      syncTransform(event.target);
    };

    const commitTextChange = (target: unknown) => {
      const object = target as LayerCanvasObject | undefined;
      const layerId = getLayerId(object);

      if (!layerId || typeof object?.text !== "string") {
        return;
      }

      onTextChangeRef.current(layerId, object.text);
    };

    const handleTextEditingExited = (event: { target?: unknown }) => {
      commitTextChange(event.target);
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

      if (currentTool === "select" && !targetLayerId) {
        panSessionRef.current = {
          isPanning: true,
          lastX: pointer.x,
          lastY: pointer.y
        };
        syncCanvasInteractionMode(runtime, currentTool, true);
        runtime.discardActiveObject();
        runtime.requestRenderAll();
        return;
      }

      const docPoint = mapClientPointToDocument(
        pointer.x,
        pointer.y,
        rect,
        currentDocument.canvas.viewport
      );

      if (
        (currentTool === "brush" || currentTool === "eraser") &&
        currentSelectedImageLayer
      ) {
        const imagePoint = mapDocumentPointToImage(docPoint, currentSelectedImageLayer);

        if (!imagePoint) {
          return;
        }

        drawSessionRef.current.mode = "mask";
        onMaskStartRef.current(
          currentSelectedImageLayer.id,
          currentTool === "brush" ? "paint" : "erase",
          imagePoint
        );
        renderOverlay();
        return;
      }

      if (currentTool === "doodle") {
        drawSessionRef.current.mode = "doodle";
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
        const bounds = getCropPreviewBounds(currentSelectedImageLayer, cropSessionRef.current.draft);
        const handle = resolveCropHandle(docPoint, bounds);

        if (!handle) {
          return;
        }

        drawSessionRef.current.mode = "crop";
        cropDragRef.current = {
          handle,
          startPoint: docPoint,
          startCrop: cropSessionRef.current.draft
        };
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

      const docPoint = mapClientPointToDocument(
        pointer.x,
        pointer.y,
        rect,
        currentDocument.canvas.viewport
      );

      if (panSessionRef.current.isPanning) {
        const deltaX = pointer.x - panSessionRef.current.lastX;
        const deltaY = pointer.y - panSessionRef.current.lastY;
        const viewportTransform = runtime.viewportTransform ?? [1, 0, 0, 1, 0, 0];
        const nextPanX = (viewportTransform[4] ?? 0) + deltaX;
        const nextPanY = (viewportTransform[5] ?? 0) + deltaY;

        panSessionRef.current.lastX = pointer.x;
        panSessionRef.current.lastY = pointer.y;
        applyViewport(runtime, viewportTransform[0] ?? 1, nextPanX, nextPanY);
        renderOverlay();
        return;
      }

      if (
        drawSessionRef.current.mode === "mask" &&
        currentSelectedImageLayer &&
        (currentTool === "brush" || currentTool === "eraser")
      ) {
        const imagePoint = mapDocumentPointToImage(docPoint, currentSelectedImageLayer);

        if (!imagePoint) {
          return;
        }

        onMaskAppendRef.current(currentSelectedImageLayer.id, imagePoint);
        renderOverlay();
        return;
      }

      if (drawSessionRef.current.mode === "doodle" && currentTool === "doodle") {
        doodlePointsRef.current = [...doodlePointsRef.current, docPoint];
        renderOverlay();
        return;
      }

      if (
        drawSessionRef.current.mode === "crop" &&
        currentTool === "crop" &&
        currentSelectedImageLayer &&
        cropDragRef.current.handle &&
        cropDragRef.current.startCrop
      ) {
        const deltaX = (docPoint.x - cropDragRef.current.startPoint.x) / currentSelectedImageLayer.transform.scaleX;
        const deltaY = (docPoint.y - cropDragRef.current.startPoint.y) / currentSelectedImageLayer.transform.scaleY;
        const startCrop = cropDragRef.current.startCrop;
        const right = startCrop.x + startCrop.width;
        const bottom = startCrop.y + startCrop.height;
        const nextLeft =
          cropDragRef.current.handle === "w" ||
          cropDragRef.current.handle === "nw" ||
          cropDragRef.current.handle === "sw"
            ? Math.round(startCrop.x + deltaX)
            : startCrop.x;
        const nextTop =
          cropDragRef.current.handle === "n" ||
          cropDragRef.current.handle === "nw" ||
          cropDragRef.current.handle === "ne"
            ? Math.round(startCrop.y + deltaY)
            : startCrop.y;
        const nextRight =
          cropDragRef.current.handle === "e" ||
          cropDragRef.current.handle === "ne" ||
          cropDragRef.current.handle === "se"
            ? Math.round(right + deltaX)
            : right;
        const nextBottom =
          cropDragRef.current.handle === "s" ||
          cropDragRef.current.handle === "sw" ||
          cropDragRef.current.handle === "se"
            ? Math.round(bottom + deltaY)
            : bottom;

        if (cropDragRef.current.handle === "move") {
          onCropSessionChangeRef.current({
            x: Math.round(startCrop.x + deltaX),
            y: Math.round(startCrop.y + deltaY)
          });
          return;
        }

        onCropSessionChangeRef.current({
          x: nextLeft,
          y: nextTop,
          width: nextRight - nextLeft,
          height: nextBottom - nextTop
        });
      }
    };

    const handleMouseWheel = (event: { e: WheelEvent }) => {
      if (!event.e.ctrlKey) {
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

      applyViewport(runtime, nextZoom, nextPanX, nextPanY);
      onViewportChangeRef.current({
        zoom: Number(nextZoom.toFixed(3)),
        panX: Math.round(nextPanX),
        panY: Math.round(nextPanY)
      });
      renderOverlay();
    };

    const stopInteraction = () => {
      if (panSessionRef.current.isPanning) {
        panSessionRef.current.isPanning = false;
        const viewportTransform = runtime.viewportTransform ?? [1, 0, 0, 1, 0, 0];
        onViewportChangeRef.current({
          zoom: viewportTransform[0] ?? 1,
          panX: viewportTransform[4] ?? 0,
          panY: viewportTransform[5] ?? 0
        });
        syncCanvasInteractionMode(runtime, activeToolRef.current);
      }

      if (drawSessionRef.current.mode === "mask" && selectedImageLayerRef.current) {
        onMaskFinishRef.current(selectedImageLayerRef.current.id);
      }

      if (drawSessionRef.current.mode === "doodle" && doodlePointsRef.current.length > 1) {
        onDoodleCommitRef.current(doodlePointsRef.current);
      }

      drawSessionRef.current.mode = null;
      doodlePointsRef.current = [];
      cropDragRef.current = {
        handle: null,
        startPoint: { x: 0, y: 0 },
        startCrop: null
      };
      renderOverlay();
    };

    runtime.on("selection:created", syncSelection);
    runtime.on("selection:updated", syncSelection);
    runtime.on("selection:cleared", syncSelection);
    runtime.on("object:modified", handleObjectModified);
    runtime.on("text:editing:exited", handleTextEditingExited);
    runtime.on("mouse:down", handleMouseDown);
    runtime.on("mouse:move", handleMouseMove);
    runtime.on("mouse:up", stopInteraction);
    runtime.on("mouse:wheel", handleMouseWheel);

    return () => {
      runtime.off("selection:created", syncSelection);
      runtime.off("selection:updated", syncSelection);
      runtime.off("selection:cleared", syncSelection);
      runtime.off("object:modified", handleObjectModified);
      runtime.off("text:editing:exited", handleTextEditingExited);
      runtime.off("mouse:down", handleMouseDown);
      runtime.off("mouse:move", handleMouseMove);
      runtime.off("mouse:up", stopInteraction);
      runtime.off("mouse:wheel", handleMouseWheel);
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [document.canvas.backgroundColor, document.canvas.height, document.canvas.width]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    const directManipulation = isDirectManipulationTool(activeTool);

    syncCanvasInteractionMode(runtime, activeTool);

    if (directManipulation) {
      runtime.discardActiveObject();
      runtime.requestRenderAll();
    }
  }, [activeTool]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    applyViewport(
      runtime,
      document.canvas.viewport.zoom,
      document.canvas.viewport.panX,
      document.canvas.viewport.panY
    );
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
        renderCanvasBackground: false
      });

      if (cancelled) {
        return;
      }

      applyViewport(
        runtime,
        document.canvas.viewport.zoom,
        document.canvas.viewport.panX,
        document.canvas.viewport.panY
      );
      suppressSyncRef.current = false;
      renderOverlay();
    };

    void render();

    return () => {
      cancelled = true;
      suppressSyncRef.current = false;
    };
  }, [cropSession, document, selectedLayerIds]);

  return (
    <div className="workspace__viewport-shell">
      <div className="workspace__viewport-inner">
        <div className="workspace__viewport-board">
          <div
            className="workspace__canvas-stack workspace__canvas-surface"
            style={canvasSurfaceStyle}
          >
            <canvas ref={canvasRef} className="workspace__canvas" height={document.canvas.height} width={document.canvas.width} />
            <canvas
              ref={overlayRef}
              className={`workspace__mask-overlay ${
                ["brush", "eraser", "doodle", "crop"].includes(activeTool)
                  ? "workspace__mask-overlay--interactive"
                  : ""
              }`}
              height={document.canvas.height}
              width={document.canvas.width}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
