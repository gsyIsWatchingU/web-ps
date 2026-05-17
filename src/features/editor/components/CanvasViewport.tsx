import { Canvas } from "fabric";
import { useEffect, useRef } from "react";
import type { EditorDocument } from "../model/document";
import type { EditorTool } from "../store/useEditorStore";
import { seedCanvas } from "../runtime/seedCanvas";

type CanvasViewportProps = {
  activeTool: EditorTool;
  document: EditorDocument;
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
  onViewportChange: (
    viewport: Partial<EditorDocument["canvas"]["viewport"]>
  ) => void;
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

export function CanvasViewport({
  activeTool,
  document,
  selectedLayerIds,
  onSelectionChange,
  onTransformChange,
  onViewportChange
}: CanvasViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<Canvas | null>(null);
  const suppressSyncRef = useRef(false);
  const panSessionRef = useRef<{
    isPanning: boolean;
    lastX: number;
    lastY: number;
  }>({
    isPanning: false,
    lastX: 0,
    lastY: 0
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
      if (activeTool !== "hand") {
        return;
      }

      const pointer = getPointerClientPosition(event.e);

      panSessionRef.current = {
        isPanning: true,
        lastX: pointer.x,
        lastY: pointer.y
      };
      runtime.discardActiveObject();
      runtime.selection = false;
      runtime.requestRenderAll();
    };

    const handleMouseMove = (event: { e: MouseEvent | TouchEvent }) => {
      if (!panSessionRef.current.isPanning || activeTool !== "hand") {
        return;
      }

      const pointer = getPointerClientPosition(event.e);
      const deltaX = pointer.x - panSessionRef.current.lastX;
      const deltaY = pointer.y - panSessionRef.current.lastY;
      const viewportTransform = runtime.viewportTransform ?? [1, 0, 0, 1, 0, 0];

      viewportTransform[4] += deltaX;
      viewportTransform[5] += deltaY;
      runtime.setViewportTransform(viewportTransform);

      panSessionRef.current.lastX = pointer.x;
      panSessionRef.current.lastY = pointer.y;
    };

    const stopPan = () => {
      if (!panSessionRef.current.isPanning) {
        return;
      }

      panSessionRef.current.isPanning = false;
      const viewportTransform = runtime.viewportTransform ?? [1, 0, 0, 1, 0, 0];
      onViewportChange({
        zoom: viewportTransform[0] ?? 1,
        panX: viewportTransform[4] ?? 0,
        panY: viewportTransform[5] ?? 0
      });
    };

    runtime.on("selection:created", syncSelection);
    runtime.on("selection:updated", syncSelection);
    runtime.on("selection:cleared", syncSelection);
    runtime.on("object:modified", handleObjectModified);
    runtime.on("mouse:down", handleMouseDown);
    runtime.on("mouse:move", handleMouseMove);
    runtime.on("mouse:up", stopPan);

    return () => {
      runtime.off("selection:created", syncSelection);
      runtime.off("selection:updated", syncSelection);
      runtime.off("selection:cleared", syncSelection);
      runtime.off("object:modified", handleObjectModified);
      runtime.off("mouse:down", handleMouseDown);
      runtime.off("mouse:move", handleMouseMove);
      runtime.off("mouse:up", stopPan);
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [activeTool, document.canvas.backgroundColor, document.canvas.height, document.canvas.viewport.panX, document.canvas.viewport.panY, document.canvas.viewport.zoom, document.canvas.width, onSelectionChange, onTransformChange, onViewportChange]);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    runtime.selection = activeTool !== "hand";
    runtime.defaultCursor = activeTool === "hand" ? "grab" : "default";
    runtime.hoverCursor = activeTool === "hand" ? "grab" : "move";

    if (activeTool === "hand") {
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
  }, [
    document.updatedAt,
    document.canvas.width,
    document.canvas.height,
    document.canvas.backgroundColor,
    document.canvas.safeAreaInset,
    document.canvas.viewport.zoom,
    document.canvas.viewport.panX,
    document.canvas.viewport.panY,
    selectedLayerIds
  ]);

  return (
    <div className="workspace__viewport-shell">
      <div className="workspace__viewport-inner">
        <div className="workspace__viewport-board">
          <canvas
            ref={canvasRef}
            className={`workspace__canvas ${
              activeTool === "hand" ? "workspace__canvas--hand" : ""
            }`}
            height={document.canvas.height}
            width={document.canvas.width}
          />
        </div>
      </div>
    </div>
  );
}
