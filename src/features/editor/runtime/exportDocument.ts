import { Canvas } from "fabric";
import type { EditorDocument } from "../model/document";
import { seedCanvas } from "./seedCanvas";

function buildExportFilename(document: EditorDocument) {
  const extension = document.exportConfig.format === "jpeg" ? "jpg" : "png";
  const scene = document.canvas.presetId.replace(":", "x");
  const version = `v${String(document.workflowMeta.version).padStart(3, "0")}`;

  return `${document.name || "web-ps-export"}-${scene}-${version}.${extension}`;
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
    runtime.setViewportTransform([1, 0, 0, 1, 0, 0]);

    const dataUrl = runtime.toDataURL({
      format: document.exportConfig.format,
      quality: document.exportConfig.quality,
      multiplier: document.exportConfig.scale
    });
    const filename = buildExportFilename(document);

    downloadDataUrl(dataUrl, filename);

    return {
      filename
    };
  } finally {
    runtime.dispose();
  }
}
