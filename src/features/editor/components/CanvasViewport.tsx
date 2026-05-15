import { Canvas } from "fabric";
import { useEffect, useRef } from "react";
import type { EditorDocument } from "../model/document";
import { seedCanvas } from "../runtime/seedCanvas";

type CanvasViewportProps = {
  document: EditorDocument;
  selectedLayerIds: string[];
  zoomPercent: number;
};

export function CanvasViewport({
  document,
  selectedLayerIds,
  zoomPercent
}: CanvasViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<Canvas | null>(null);

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

    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;

    if (!runtime) {
      return;
    }

    let cancelled = false;

    const render = async () => {
      await seedCanvas(runtime, document, selectedLayerIds);
      if (cancelled) {
        return;
      }
    };

    void render();

    return () => {
      cancelled = true;
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
