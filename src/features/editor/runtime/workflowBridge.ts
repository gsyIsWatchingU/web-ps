import type { EditorDocument } from "../model/document";
import { getImageLayerSource } from "../model/document";
import { requestRenderPreview } from "./backendBridge";
import { renderDocumentDataUrl } from "./exportDocument";

type WorkflowApplyResult = {
  success: boolean;
  message: string;
};

export async function applyToWorkflow(document: EditorDocument): Promise<WorkflowApplyResult> {
  const targetWindow = window.opener ?? window.parent;

  if (!targetWindow || targetWindow === window) {
    return {
      success: false,
      message: "当前环境没有可回填的图文流程宿主，请先使用导出功能。"
    };
  }

  let previewImageDataUrl = await renderDocumentDataUrl(document);
  let previewResult = null;

  try {
    previewResult = await requestRenderPreview(document);
    if (previewResult?.previewUrl) {
      previewImageDataUrl = previewResult.previewUrl;
    }
  } catch {
    previewResult = null;
  }

  const assetRefs = document.layers
    .filter((layer) => layer.type === "image")
    .map((layer) => ({
      layerId: layer.id,
      assetId: layer.assetId,
      sourceOrigin: layer.sourceOrigin,
      sourceUrl: layer.sourceUrl,
      sourceDataUrl: layer.sourceDataUrl,
      effectiveSource: getImageLayerSource(layer)
    }));

  targetWindow.postMessage(
    {
      type: "web-ps:apply-result",
      filename: `${document.name}.${document.exportConfig.format === "jpeg" ? "jpg" : "png"}`,
      documentId: document.id,
      documentVersion: document.version,
      format: document.exportConfig.format,
      sceneTag: document.workflowMeta.sceneTag,
      version: document.workflowMeta.version,
      assetRefs,
      renderRequest: document.renderRequest,
      previewImageDataUrl,
      imageDataUrl: previewImageDataUrl,
      previewResult,
      timestamp: new Date().toISOString()
    },
    document.workflowMeta.targetOrigin || "*"
  );

  return {
    success: true,
    message: "已将当前成品回填到图文流程宿主。"
  };
}
