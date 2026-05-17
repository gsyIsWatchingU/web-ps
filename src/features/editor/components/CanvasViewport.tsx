import { Canvas } from "fabric";
import { useEffect, useRef } from "react";
import type {
  EditorDocument,
  EditorTool,
  ImageLayer,
  MaskPoint
} from "../model/document";
import { seedCanvas } from "../runtime/seedCanvas";

type CanvasViewportProps = {
  activeTool: EditorTool;
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

function drawMaskOverlay(
  context: CanvasRenderingContext2D,
  layer: ImageLayer,
  viewport: EditorDocument["canvas"]["viewport"]
) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);

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

function mapDocumentPointToImage(
  docPoint: { x: number; y: number },
  layer: ImageLayer
) {
  const width = layer.crop.width * layer.transform.scaleX;
  const height = layer.crop.height * layer.transform.scaleY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const normalizedX = (docPoint.x - layer.transform.x) / width;
  const normalizedY = (docPoint.y - layer.transform.y) / height;

  if (
    normalizedX < 0 ||
    normalizedY < 0 ||
    normalizedX > 1 ||
    normalizedY > 1
  ) {
    return null;
  }

  return {
    x: normalizedX,
    y: normalizedY
  } satisfies MaskPoint;
}

export function CanvasViewport({
  activeTool,
  document,
  selectedImageLayer,
  selectedLayerIds,
  onSelectionChange,
  onTransformChange,
  onViewportChange,
  onMaskStart,
  onMaskAppend,
  onMaskFinish
}: CanvasViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<Canvas | null>(null);
  const suppressSyncRef = useRef(false);
  const panSessionRef = useRef({
    isPanning: false,
    lastX: 0,
    lastY: 0
  });
  const drawSessionRef = useRef({
    isDrawing: false
  });

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
      if (suppressSyncRef.current || activeTool === "hand") {
        return;
      }

      const activeObject = runtime.getActiveObject();
      const layerId = getLayerId(activeObject);
      onSelectionChange(layerId ? [layerId] : []);
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

      onTransformChange(layerId, {
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

      if (activeTool === "hand") {
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
        (activeTool === "brush" || activeTool === "eraser") &&
        selectedImageLayer &&
        overlayRef.current
      ) {
        const rect = overlayRef.current.getBoundingClientRect();
        const docPoint = mapClientPointToDocument(
          pointer.x,
          pointer.y,
          rect,
          document.canvas.viewport
        );
        const imagePoint = mapDocumentPointToImage(docPoint, selectedImageLayer);

        if (!imagePoint) {
          return;
        }

        drawSessionRef.current.isDrawing = true;
        onMaskStart(
          selectedImageLayer.id,
          activeTool === "brush" ? "paint" : "erase",
          imagePoint
        );
      }
    };

    const handleMouseMove = (event: { e: MouseEvent | TouchEvent }) => {
      const pointer = getPointerClientPosition(event.e);

      if (panSessionRef.current.isPanning && activeTool === "hand") {
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
        drawSessionRef.current.isDrawing &&
        selectedImageLayer &&
        overlayRef.current &&
        (activeTool === "brush" || activeTool === "eraser")
      ) {
        const rect = overlayRef.current.getBoundingClientRect();
        const docPoint = mapClientPointToDocument(
          pointer.x,
          pointer.y,
          rect,
          document.canvas.viewport
        );
        const imagePoint = mapDocumentPointToImage(docPoint, selectedImageLayer);

        if (!imagePoint) {
          return;
        }

        onMaskAppend(selectedImageLayer.id, imagePoint);
      }
    };

    const stopInteraction = () => {
      if (panSessionRef.current.isPanning) {
        panSessionRef.current.isPanning = false;
        const viewportTransform = runtime.viewportTransform ?? [1, 0, 0, 1, 0, 0];
        onViewportChange({
          zoom: viewportTransform[0] ?? 1,
          panX: viewportTransform[4] ?? 0,
          panY: viewportTransform[5] ?? 0
        });
      }

      if (drawSessionRef.current.isDrawing && selectedImageLayer) {
        drawSessionRef.current.isDrawing = false;
        onMaskFinish(selectedImageLayer.id);
      }
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
  }, [
    activeTool,
    document.canvas.backgroundColor,
    document.canvas.height,
    document.canvas.viewport,
    document.canvas.width,
    onMaskAppend,
    onMaskFinish,
    onMaskStart,
    onSelectionChange,
    onTransformChange,
    onViewportChange,
    selectedImageLayer
  ]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    const isDirectManipulationTool =
      activeTool === "hand" || activeTool === "brush" || activeTool === "eraser";

    runtime.selection = !isDirectManipulationTool;
    runtime.defaultCursor =
      activeTool === "hand"
        ? "grab"
        : activeTool === "brush"
          ? "crosshair"
          : activeTool === "eraser"
            ? "cell"
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
  }, [document.canvas.viewport.panX, document.canvas.viewport.panY, document.canvas.viewport.zoom]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    let cancelled = false;

    const render = async () => {
      suppressSyncRef.current = true;
      await seedCanvas(runtime, document, selectedLayerIds);
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
    };

    void render();

    return () => {
      cancelled = true;
      suppressSyncRef.current = false;
    };
  }, [document, selectedLayerIds]);

  useEffect(() => {
    const overlay = overlayRef.current;

    if (!overlay || !selectedImageLayer) {
      if (overlay) {
        const context = overlay.getContext("2d");
        context?.clearRect(0, 0, overlay.width, overlay.height);
      }
      return;
    }

    const context = overlay.getContext("2d");

    if (!context) {
      return;
    }

    drawMaskOverlay(context, selectedImageLayer, document.canvas.viewport);
  }, [document.canvas.viewport, selectedImageLayer]);

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
                activeTool === "brush" || activeTool === "eraser"
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
