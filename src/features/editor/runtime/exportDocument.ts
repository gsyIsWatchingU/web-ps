import { Canvas } from "fabric";
import type { EditorDocument } from "../model/document";
import { seedCanvas } from "./seedCanvas";

function buildExportFilename(document: EditorDocument) {
  const extension = document.exportConfig.format === "jpeg" ? "jpg" : "png";
  return `${document.name || "web-ps-export"}.${extension}`;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = window.document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function exportDocument(document: EditorDocument) {
  const canvasElement = window.document.createElement("canvas");
  const runtime = new Canvas(canvasElement, {
    width: document.canvas.width,
    height: document.canvas.height,
    backgroundColor: document.canvas.backgroundColor,
    preserveObjectStacking: true,
    selection: false
  });

  try {
    await seedCanvas(runtime, document, [], { showSafeArea: false });
    const dataUrl = runtime.toDataURL({
      format: document.exportConfig.format,
      quality: document.exportConfig.quality,
      multiplier: document.exportConfig.scale
    });

    downloadDataUrl(dataUrl, buildExportFilename(document));
  } finally {
    runtime.dispose();
  }
}
