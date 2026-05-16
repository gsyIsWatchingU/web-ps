import { Canvas } from "fabric";
import { useEffect, useRef } from "react";
import type { EditorDocument } from "../model/document";
import { seedCanvas } from "../runtime/seedCanvas";

type CanvasViewportProps = {
  document: EditorDocument;
  selectedLayerIds: string[];
  zoomPercent: number;
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

export function CanvasViewport({
  document,
  selectedLayerIds,
  zoomPercent,
  onSelectionChange,
  onTransformChange
}: CanvasViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<Canvas | null>(null);
  const suppressSyncRef = useRef(false);

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

    const syncSelection = () => {
      if (suppressSyncRef.current) {
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

    runtime.on("selection:created", syncSelection);
    runtime.on("selection:updated", syncSelection);
    runtime.on("selection:cleared", syncSelection);
    runtime.on("object:modified", handleObjectModified);

    return () => {
      runtime.off("selection:created", syncSelection);
      runtime.off("selection:updated", syncSelection);
      runtime.off("selection:cleared", syncSelection);
      runtime.off("object:modified", handleObjectModified);
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [onSelectionChange, onTransformChange]);

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
      suppressSyncRef.current = false;
    };

    void render();

    return () => {
      cancelled = true;
      suppressSyncRef.current = false;
    };
  }, [document, selectedLayerIds]);

  return (
    <div className="workspace__viewport-shell">
      <div className="workspace__viewport-inner">
        <div
          className="workspace__viewport-board"
          style={{ transform: `scale(${zoomPercent / 100})` }}
        >
          <canvas
            ref={canvasRef}
            className="workspace__canvas"
            height={document.canvas.height}
            width={document.canvas.width}
          />
        </div>
      </div>
    </div>
  );
}
