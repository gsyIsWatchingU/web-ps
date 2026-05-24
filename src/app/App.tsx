import { useEffect, useMemo, useState } from "react";
import { DownloadOutlined } from "@ant-design/icons";
import { Space } from "antd";
import { EditorWorkspace } from "../features/editor/components/EditorWorkspace";
import { HelpCenter } from "../features/editor/components/HelpCenter";
import { TemplateCenter } from "../features/editor/components/TemplateCenter";
import type { PlatformPresetId, TemplateDefinitionId } from "../features/editor/model/ecommerce";
import { useEditorStore } from "../features/editor/store/useEditorStore";
import { MessageProvider } from "../shared/message";

const EXPORT_STATE_EVENT = "editor:export-state";
const OPEN_EXPORT_DIALOG_EVENT = "editor:open-export-dialog";

type ExportStateDetail = {
  isExporting: boolean;
};

export function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessProductsOpen, setIsProcessProductsOpen] = useState(false);
  const [isTemplateCenterOpen, setIsTemplateCenterOpen] = useState(true);

  const { document, createBlankDocument, createDocumentFromTemplate, setPlatformPreset } =
    useEditorStore();

  const processProducts = useMemo<
    Array<{
      type: "AI Repair" | "3D Model";
      layerLabel: string;
      downloadUrl: string;
      fileName: string;
    }>
  >(() => {
    const products: Array<{
      type: "AI Repair" | "3D Model";
      layerLabel: string;
      downloadUrl: string;
      fileName: string;
    }> = [];

    document.layers.forEach((layer, index) => {
      if (layer.type !== "image") {
        return;
      }

      if (layer.aiMeta.repairTask?.status === "succeeded" && layer.aiMeta.repairTask.downloadUrl) {
        products.push({
          type: "AI Repair",
          layerLabel: layer.name || `Image ${index + 1}`,
          downloadUrl: layer.aiMeta.repairTask.downloadUrl,
          fileName: layer.aiMeta.repairTask.fileName || "repair-result.jpg"
        });
      }

      if (layer.aiMeta.model3dTask?.status === "succeeded" && layer.aiMeta.model3dTask.downloadUrl) {
        products.push({
          type: "3D Model",
          layerLabel: layer.name || `Image ${index + 1}`,
          downloadUrl: layer.aiMeta.model3dTask.downloadUrl,
          fileName: layer.aiMeta.model3dTask.fileName || "model.glb"
        });
      }
    });

    return products.reverse();
  }, [document.layers]);

  useEffect(() => {
    const handleExportState = (event: Event) => {
      const customEvent = event as CustomEvent<ExportStateDetail>;
      setIsExporting(Boolean(customEvent.detail?.isExporting));
    };

    window.addEventListener(EXPORT_STATE_EVENT, handleExportState as EventListener);
    return () => window.removeEventListener(EXPORT_STATE_EVENT, handleExportState as EventListener);
  }, []);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const handleExportRequest = () => {
    window.dispatchEvent(new CustomEvent(OPEN_EXPORT_DIALOG_EVENT));
  };

  const handleUseTemplate = (
    templateId: TemplateDefinitionId,
    platformPresetId: PlatformPresetId
  ) => {
    createDocumentFromTemplate(templateId);
    setPlatformPreset(platformPresetId);
    setIsTemplateCenterOpen(false);
    setIsHelpOpen(false);
  };

  const handleStartFreeEdit = (platformPresetId: PlatformPresetId) => {
    createBlankDocument(platformPresetId);
    setIsTemplateCenterOpen(false);
    setIsHelpOpen(false);
  };

  return (
    <MessageProvider>
      <div className="app-shell">
        <header className="app-shell__header">
          <div>
            <h1 className="eyebrow">Pic Boost</h1>
            <p className="workspace__meta">
              使用模板、平台预设和快捷修图工具，将 AI 初稿快速加工成可投放的电商素材。
            </p>
          </div>
          <div className="app-shell__header-actions">
            <button
              className="app-shell__help-button"
              onClick={() => {
                setIsHelpOpen(false);
                setIsTemplateCenterOpen((value) => !value);
              }}
              type="button"
            >
              {isTemplateCenterOpen ? "返回编辑器" : "模板"}
            </button>
            <button
              className="app-shell__help-button"
              onClick={() => setIsHelpOpen((value) => !value)}
              type="button"
            >
              {isHelpOpen ? "关闭帮助" : "帮助"}
            </button>
            <div className="app-shell__process-products-dropdown">
              <button
                className="app-shell__process-products-button"
                type="button"
                onClick={() => setIsProcessProductsOpen(!isProcessProductsOpen)}
              >
                AI 产物
              </button>
              {isProcessProductsOpen ? (
                <div className="app-shell__dropdown-menu">
                  {processProducts.length === 0 ? (
                    <div className="app-shell__dropdown-empty">暂无 AI 产物</div>
                  ) : (
                    processProducts.map((product, index) => (
                      <a
                        key={index}
                        href={product.downloadUrl}
                        download={product.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="app-shell__dropdown-item"
                      >
                        <span className="app-shell__product-type">{product.type}</span>
                        <span className="app-shell__product-layer">
                          <Space>
                            {product.layerLabel}
                            <DownloadOutlined />
                          </Space>
                        </span>
                      </a>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <button
              className="app-shell__primary-button"
              disabled={isExporting}
              onClick={handleExportRequest}
              type="button"
            >
              {isExporting ? "导出中..." : "导出"}
            </button>
          </div>
        </header>

        {isHelpOpen ? (
          <HelpCenter onClose={() => setIsHelpOpen(false)} />
        ) : isTemplateCenterOpen ? (
          <TemplateCenter
            activeTemplateName={document.templateMeta.templateName}
            hasDraft={document.layers.length > 0}
            onContinueDraft={() => setIsTemplateCenterOpen(false)}
            onStartFreeEdit={handleStartFreeEdit}
            onUseTemplate={handleUseTemplate}
          />
        ) : (
          <EditorWorkspace />
        )}
      </div>
    </MessageProvider>
  );
}
