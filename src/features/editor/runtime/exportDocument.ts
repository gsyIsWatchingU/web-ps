import { Canvas } from "fabric";
import type { EditorDocument } from "../model/document";
import { buildSuggestedExportFilename } from "../model/ecommerce";
import { seedCanvas } from "./seedCanvas";

function getExportQuality(config: EditorDocument["exportConfig"]) {
  return config.qualityPreset === "high" ? 0.92 : 0.82;
}

function getExportDimensions(document: EditorDocument) {
  const { canvas, exportConfig } = document;

  if (exportConfig.resizeMode === "scale") {
    return {
      width: Math.max(1, Math.round((canvas.width * exportConfig.scalePercent) / 100)),
      height: Math.max(1, Math.round((canvas.height * exportConfig.scalePercent) / 100))
    };
  }

  return {
    width: Math.max(1, Math.round(exportConfig.width)),
    height: Math.max(1, Math.round(exportConfig.height))
  };
}

async function loadDataUrlImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to render export preview."));
    image.src = source;
  });
}

function buildExportFilename(document: EditorDocument) {
  const extension = document.exportConfig.format === "jpeg" ? "jpg" : "png";
  const basename = buildSuggestedExportFilename(document);

  return `${basename}.${extension}`;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = window.document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function renderDocumentDataUrl(document: EditorDocument) {
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

    const sourceDataUrl = runtime.toDataURL({
      format: document.exportConfig.format,
      quality: getExportQuality(document.exportConfig),
      multiplier: 1
    });
    const { width, height } = getExportDimensions(document);

    if (width === document.canvas.width && height === document.canvas.height) {
      return sourceDataUrl;
    }

    const image = await loadDataUrlImage(sourceDataUrl);
    const outputCanvas = window.document.createElement("canvas");
    outputCanvas.width = width;
    outputCanvas.height = height;

    const context = outputCanvas.getContext("2d");

    if (!context) {
      throw new Error("Failed to create export canvas.");
    }

    context.drawImage(image, 0, 0, width, height);

    return outputCanvas.toDataURL(
      document.exportConfig.format === "jpeg" ? "image/jpeg" : "image/png",
      getExportQuality(document.exportConfig)
    );
  } finally {
    runtime.dispose();
  }
}

export async function exportDocument(document: EditorDocument) {
  const dataUrl = await renderDocumentDataUrl(document);
  const filename = buildExportFilename(document);

  downloadDataUrl(dataUrl, filename);

  return {
    filename,
    dataUrl
  };
}
