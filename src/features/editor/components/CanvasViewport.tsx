import { Canvas } from "fabric";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  CanvasBackgroundMode,
  DoodlePoint,
  DoodleLayer,
  EditorDocument,
  EditorTool,
  ImageCrop,
  ImageLayer
} from "../model/document";
import { getDefaultSafeAreaInset } from "../model/document";
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
  doodleStyle: Pick<DoodleLayer, "stroke" | "strokeWidth">;
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
  data?: { layerId?: string };
  text?: string;
};

type CropHandle = "move" | "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se" | null;

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

function isDirectManipulationTool(activeTool: EditorTool) {
  return ["crop", "doodle"].includes(activeTool);
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
    const isLocked = layer?.locked ?? true;
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

function resolveCropHandle(docPoint: DoodlePoint, bounds: ReturnType<typeof getCropPreviewBounds>): CropHandle {
  const edgeTolerance = 12;
  const cornerTolerance = 14;
  const withinX = docPoint.x >= bounds.cropX && docPoint.x <= bounds.cropX + bounds.cropWidth;
  const withinY = docPoint.y >= bounds.cropY && docPoint.y <= bounds.cropY + bounds.cropHeight;
  const nearLeft = Math.abs(docPoint.x - bounds.cropX) <= edgeTolerance;
  const nearRight = Math.abs(docPoint.x - (bounds.cropX + bounds.cropWidth)) <= edgeTolerance;
  const nearTop = Math.abs(docPoint.y - bounds.cropY) <= edgeTolerance;
  const nearBottom = Math.abs(docPoint.y - (bounds.cropY + bounds.cropHeight)) <= edgeTolerance;

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
    docPoint.x >= bounds.cropX + cornerTolerance &&
    docPoint.x <= bounds.cropX + bounds.cropWidth - cornerTolerance &&
    docPoint.y >= bounds.cropY + cornerTolerance &&
    docPoint.y <= bounds.cropY + bounds.cropHeight - cornerTolerance
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

  context.save();
  context.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.panX, viewport.panY);
  context.fillStyle = "rgba(28, 37, 32, 0.28)";
  context.fillRect(bounds.imageX, bounds.imageY, bounds.imageWidth, bounds.imageHeight);
  context.clearRect(bounds.cropX, bounds.cropY, bounds.cropWidth, bounds.cropHeight);
  context.strokeStyle = "#cd5c2d";
  context.lineWidth = 2;
  context.strokeRect(bounds.cropX, bounds.cropY, bounds.cropWidth, bounds.cropHeight);
  context.restore();
}

function drawSafeAreaOverlay(
  context: CanvasRenderingContext2D,
  document: EditorDocument,
  viewport: EditorDocument["canvas"]["viewport"]
) {
  const inset =
    document.canvas.safeAreaInset > 0
      ? document.canvas.safeAreaInset
      : getDefaultSafeAreaInset(document.canvas.width, document.canvas.height);
  const safeX = inset;
  const safeY = inset;
  const safeWidth = Math.max(0, document.canvas.width - inset * 2);
  const safeHeight = Math.max(0, document.canvas.height - inset * 2);

  if (safeWidth <= 0 || safeHeight <= 0) {
    return;
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

  context.fillStyle = "rgba(195, 111, 73, 0.94)";
  context.font = '600 18px "Segoe UI"';
  context.textBaseline = "bottom";
  context.fillText("Safe area", safeX + 12, Math.max(24, safeY - 10));
  context.restore();
}

export function CanvasViewport({
  activeTool,
  cropSession,
  doodleStyle,
  document,
  selectedImageLayer,
  selectedLayerIds,
  onSelectionChange,
  onTextChange,
  onTransformChange,
  onViewportChange,
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
  const onDoodleCommitRef = useRef(onDoodleCommit);
  const onCropSessionChangeRef = useRef(onCropSessionChange);
  const panSessionRef = useRef({ isPanning: false, lastX: 0, lastY: 0 });
  const drawSessionRef = useRef({ mode: null as "doodle" | "crop" | null });
  const doodlePointsRef = useRef<DoodlePoint[]>([]);
  const cropDragRef = useRef<{ handle: CropHandle; startPoint: DoodlePoint; startCrop: ImageCrop | null }>({
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
    drawSafeAreaOverlay(context, documentRef.current, documentRef.current.canvas.viewport);

    if (activeToolRef.current === "doodle") {
      drawDoodlePreview(context, doodlePointsRef.current, documentRef.current.canvas.viewport, doodleStyle);
    }

    if (
      activeToolRef.current === "crop" &&
      cropSessionRef.current &&
      selectedImageLayerRef.current &&
      cropSessionRef.current.layerId === selectedImageLayerRef.current.id
    ) {
      drawCropOverlay(context, selectedImageLayerRef.current, cropSessionRef.current.draft, documentRef.current.canvas.viewport);
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
    onDoodleCommitRef.current = onDoodleCommit;
    onCropSessionChangeRef.current = onCropSessionChange;
    renderOverlay();
  }, [
    activeTool,
    cropSession,
    document,
    onCropSessionChange,
    onDoodleCommit,
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
    applyViewport(runtime, document.canvas.viewport.zoom, document.canvas.viewport.panX, document.canvas.viewport.panY);

    const syncSelection = () => {
      if (suppressSyncRef.current || ["crop", "doodle"].includes(activeToolRef.current)) {
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

      if (currentTool === "select" && !targetLayerId) {
        panSessionRef.current = { isPanning: true, lastX: pointer.x, lastY: pointer.y };
        syncCanvasInteractionMode(runtime, currentDocument, currentTool, true);
        runtime.discardActiveObject();
        runtime.requestRenderAll();
        return;
      }

      const docPoint = mapClientPointToDocument(pointer.x, pointer.y, rect, currentDocument.canvas.viewport);

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
        const handle = resolveCropHandle(docPoint, getCropPreviewBounds(currentSelectedImageLayer, cropSessionRef.current.draft));

        if (!handle) {
          return;
        }

        drawSessionRef.current.mode = "crop";
        cropDragRef.current = { handle, startPoint: docPoint, startCrop: cropSessionRef.current.draft };
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
        const nextPanX = (viewportTransform[4] ?? 0) + deltaX;
        const nextPanY = (viewportTransform[5] ?? 0) + deltaY;

        panSessionRef.current.lastX = pointer.x;
        panSessionRef.current.lastY = pointer.y;
        applyViewport(runtime, viewportTransform[0] ?? 1, nextPanX, nextPanY);
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

        if (cropDragRef.current.handle === "move") {
          onCropSessionChangeRef.current({ x: Math.round(startCrop.x + deltaX), y: Math.round(startCrop.y + deltaY) });
          return;
        }

        const nextLeft = ["w", "nw", "sw"].includes(cropDragRef.current.handle) ? Math.round(startCrop.x + deltaX) : startCrop.x;
        const nextTop = ["n", "nw", "ne"].includes(cropDragRef.current.handle) ? Math.round(startCrop.y + deltaY) : startCrop.y;
        const nextRight = ["e", "ne", "se"].includes(cropDragRef.current.handle) ? Math.round(right + deltaX) : right;
        const nextBottom = ["s", "sw", "se"].includes(cropDragRef.current.handle) ? Math.round(bottom + deltaY) : bottom;

        onCropSessionChangeRef.current({ x: nextLeft, y: nextTop, width: nextRight - nextLeft, height: nextBottom - nextTop });
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
      onViewportChangeRef.current({ zoom: Number(nextZoom.toFixed(3)), panX: Math.round(nextPanX), panY: Math.round(nextPanY) });
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

      drawSessionRef.current.mode = null;
      doodlePointsRef.current = [];
      cropDragRef.current = { handle: null, startPoint: { x: 0, y: 0 }, startCrop: null };
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

    return () => {
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
    syncCanvasInteractionMode(runtime, documentRef.current, activeTool);

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
  }, [cropSession, document, doodleStyle, selectedLayerIds]);

  return (
    <div className="workspace__viewport-shell">
      <div className="workspace__viewport-inner">
        <div className="workspace__viewport-board">
          <div className="workspace__canvas-stack workspace__canvas-surface" style={canvasSurfaceStyle}>
            <canvas ref={canvasRef} className="workspace__canvas" height={document.canvas.height} width={document.canvas.width} />
            <canvas
              ref={overlayRef}
              className={`workspace__mask-overlay ${["doodle", "crop"].includes(activeTool) ? "workspace__mask-overlay--interactive" : ""}`}
              height={document.canvas.height}
              width={document.canvas.width}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
