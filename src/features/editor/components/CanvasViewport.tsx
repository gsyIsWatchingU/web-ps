import { Canvas } from "fabric";
import { useEffect, useRef } from "react";
import type {
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
};

type CropHandle = "move" | "nw" | "ne" | "sw" | "se" | null;

function getLayerId(target: unknown) {
  return (target as LayerCanvasObject | undefined)?.data?.layerId ?? null;
}

function applyViewport(runtime: Canvas, zoom: number, panX: number, panY: number) {
  runtime.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
  runtime.requestRenderAll();
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
  const handleRadius = 8;

  context.save();
  context.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.panX, viewport.panY);

  context.fillStyle = "rgba(28, 37, 32, 0.28)";
  context.fillRect(bounds.imageX, bounds.imageY, bounds.imageWidth, bounds.imageHeight);
  context.clearRect(bounds.cropX, bounds.cropY, bounds.cropWidth, bounds.cropHeight);

  context.strokeStyle = "#cd5c2d";
  context.lineWidth = 2;
  context.strokeRect(bounds.cropX, bounds.cropY, bounds.cropWidth, bounds.cropHeight);

  const handles = [
    { x: bounds.cropX, y: bounds.cropY },
    { x: bounds.cropX + bounds.cropWidth, y: bounds.cropY },
    { x: bounds.cropX, y: bounds.cropY + bounds.cropHeight },
    { x: bounds.cropX + bounds.cropWidth, y: bounds.cropY + bounds.cropHeight }
  ];

  context.fillStyle = "#fffaf3";
  handles.forEach((handle) => {
    context.beginPath();
    context.arc(handle.x, handle.y, handleRadius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
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
      backgroundColor: document.canvas.backgroundColor,
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
        ["hand", "brush", "eraser", "crop", "doodle"].includes(activeToolRef.current)
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

    const handleMouseDown = (event: { e: MouseEvent | TouchEvent }) => {
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

      if (currentTool === "hand") {
        panSessionRef.current = {
          isPanning: true,
          lastX: pointer.x,
          lastY: pointer.y
        };
        runtime.discardActiveObject();
        runtime.selection = false;
        runtime.requestRenderAll();
        return;
      }

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
        const handleSize = 14;
        const corners = {
          nw: { x: bounds.cropX, y: bounds.cropY },
          ne: { x: bounds.cropX + bounds.cropWidth, y: bounds.cropY },
          sw: { x: bounds.cropX, y: bounds.cropY + bounds.cropHeight },
          se: { x: bounds.cropX + bounds.cropWidth, y: bounds.cropY + bounds.cropHeight }
        } as const;

        let handle: CropHandle = null;

        (Object.keys(corners) as Array<Exclude<CropHandle, "move" | null>>).forEach((key) => {
          const corner = corners[key];
          if (
            Math.abs(docPoint.x - corner.x) <= handleSize &&
            Math.abs(docPoint.y - corner.y) <= handleSize
          ) {
            handle = key;
          }
        });

        if (
          !handle &&
          docPoint.x >= bounds.cropX &&
          docPoint.x <= bounds.cropX + bounds.cropWidth &&
          docPoint.y >= bounds.cropY &&
          docPoint.y <= bounds.cropY + bounds.cropHeight
        ) {
          handle = "move";
        }

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

      if (panSessionRef.current.isPanning && currentTool === "hand") {
        const deltaX = pointer.x - panSessionRef.current.lastX;
        const deltaY = pointer.y - panSessionRef.current.lastY;
        const viewportTransform = runtime.viewportTransform ?? [1, 0, 0, 1, 0, 0];

        viewportTransform[4] += deltaX;
        viewportTransform[5] += deltaY;
        runtime.setViewportTransform(viewportTransform);

        panSessionRef.current.lastX = pointer.x;
        panSessionRef.current.lastY = pointer.y;
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

        if (cropDragRef.current.handle === "move") {
          onCropSessionChangeRef.current({
            x: Math.round(startCrop.x + deltaX),
            y: Math.round(startCrop.y + deltaY)
          });
          return;
        }

        if (cropDragRef.current.handle === "nw") {
          onCropSessionChangeRef.current({
            x: Math.round(startCrop.x + deltaX),
            y: Math.round(startCrop.y + deltaY),
            width: Math.round(right - (startCrop.x + deltaX)),
            height: Math.round(bottom - (startCrop.y + deltaY))
          });
          return;
        }

        if (cropDragRef.current.handle === "ne") {
          onCropSessionChangeRef.current({
            y: Math.round(startCrop.y + deltaY),
            width: Math.round(startCrop.width + deltaX),
            height: Math.round(bottom - (startCrop.y + deltaY))
          });
          return;
        }

        if (cropDragRef.current.handle === "sw") {
          onCropSessionChangeRef.current({
            x: Math.round(startCrop.x + deltaX),
            width: Math.round(right - (startCrop.x + deltaX)),
            height: Math.round(startCrop.height + deltaY)
          });
          return;
        }

        if (cropDragRef.current.handle === "se") {
          onCropSessionChangeRef.current({
            width: Math.round(startCrop.width + deltaX),
            height: Math.round(startCrop.height + deltaY)
          });
        }
      }
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
    runtime.on("mouse:down", handleMouseDown);
    runtime.on("mouse:move", handleMouseMove);
    runtime.on("mouse:up", stopInteraction);

    return () => {
      runtime.off("selection:created", syncSelection);
      runtime.off("selection:updated", syncSelection);
      runtime.off("selection:cleared", syncSelection);
      runtime.off("object:modified", handleObjectModified);
      runtime.off("mouse:down", handleMouseDown);
      runtime.off("mouse:move", handleMouseMove);
      runtime.off("mouse:up", stopInteraction);
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [document.canvas.backgroundColor, document.canvas.height, document.canvas.width]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    const isDirectManipulationTool = ["hand", "brush", "eraser", "crop", "doodle"].includes(
      activeTool
    );

    runtime.selection = !isDirectManipulationTool;
    runtime.defaultCursor =
      activeTool === "hand"
        ? "grab"
        : ["brush", "eraser", "doodle", "crop"].includes(activeTool)
          ? "crosshair"
          : "default";
    runtime.hoverCursor = runtime.defaultCursor;

    if (isDirectManipulationTool) {
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
        cropPreview: cropSession
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
          <div className="workspace__canvas-stack">
            <canvas
              ref={canvasRef}
              className={`workspace__canvas ${
                activeTool === "hand" ? "workspace__canvas--hand" : ""
              }`}
              height={document.canvas.height}
              width={document.canvas.width}
            />
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
