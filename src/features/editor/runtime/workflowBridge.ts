import type { EditorDocument } from "../model/document";
import { getImageLayerSource } from "../model/document";
import { requestRenderPreview } from "./backendBridge";
import { renderDocumentDataUrl } from "./exportDocument";

type WorkflowApplyResult = {
  success: boolean;
  message: string;
};

type WorkflowApplyOptions = {
  beforeApply?: () => Promise<unknown>;
  resolveDocument?: () => EditorDocument;
};

export async function applyToWorkflow(
  document: EditorDocument,
  options?: WorkflowApplyOptions
): Promise<WorkflowApplyResult> {
  if (options?.beforeApply) {
    await options.beforeApply();
  }

  const effectiveDocument = options?.resolveDocument?.() ?? document;
  const targetWindow = window.opener ?? window.parent;

  if (!targetWindow || targetWindow === window) {
    return {
      success: false,
      message: "当前环境没有可回填的图文流程宿主，请先使用导出功能。"
    };
  }

  let previewImageDataUrl = await renderDocumentDataUrl(effectiveDocument);
  let previewResult = null;

  try {
    previewResult = await requestRenderPreview(effectiveDocument);
    if (previewResult?.previewUrl) {
      previewImageDataUrl = previewResult.previewUrl;
    }
  } catch {
    previewResult = null;
  }

  const assetRefs = effectiveDocument.layers
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
      filename: `${effectiveDocument.name}.${effectiveDocument.exportConfig.format === "jpeg" ? "jpg" : "png"}`,
      documentId: effectiveDocument.id,
      documentVersion: effectiveDocument.version,
      format: effectiveDocument.exportConfig.format,
      sceneTag: effectiveDocument.workflowMeta.sceneTag,
      version: effectiveDocument.workflowMeta.version,
      assetRefs,
      renderRequest: effectiveDocument.renderRequest,
      previewImageDataUrl,
      imageDataUrl: previewImageDataUrl,
      previewResult,
      timestamp: new Date().toISOString()
    },
    effectiveDocument.workflowMeta.targetOrigin || "*"
  );

  return {
    success: true,
    message: "已将当前成品回填到图文流程宿主。"
  };
}
