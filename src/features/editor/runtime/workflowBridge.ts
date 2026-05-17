import type { EditorDocument } from "../model/document";
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

  const dataUrl = await renderDocumentDataUrl(document);

  targetWindow.postMessage(
    {
      type: "web-ps:apply-result",
      filename: `${document.name}.${document.exportConfig.format === "jpeg" ? "jpg" : "png"}`,
      format: document.exportConfig.format,
      sceneTag: document.workflowMeta.sceneTag,
      version: document.workflowMeta.version,
      imageDataUrl: dataUrl,
      timestamp: new Date().toISOString()
    },
    document.workflowMeta.targetOrigin || "*"
  );

  return {
    success: true,
    message: "已将当前成品回填到图文流程宿主。"
  };
}
