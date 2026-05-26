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

const APP_ROUTES = {
  editor: "/editor",
  help: "/help",
  templates: "/templates"
} as const;

type AppRoute = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];

type ExportStateDetail = {
  isExporting: boolean;
};

function resolveRoute(pathname: string): AppRoute {
  if (pathname === APP_ROUTES.help) {
    return APP_ROUTES.help;
  }

  if (pathname === APP_ROUTES.editor) {
    return APP_ROUTES.editor;
  }

  return APP_ROUTES.templates;
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => resolveRoute(window.location.pathname));
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessProductsOpen, setIsProcessProductsOpen] = useState(false);

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
    const normalizedRoute = resolveRoute(window.location.pathname);

    if (window.location.pathname !== normalizedRoute) {
      window.history.replaceState(null, "", normalizedRoute);
    }

    setRoute(normalizedRoute);

    const handlePopState = () => {
      setRoute(resolveRoute(window.location.pathname));
      setIsProcessProductsOpen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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

  const navigateTo = (nextRoute: AppRoute) => {
    if (nextRoute === route) {
      return;
    }

    window.history.pushState(null, "", nextRoute);
    setRoute(nextRoute);
    setIsProcessProductsOpen(false);
  };

  const handleExportRequest = () => {
    window.dispatchEvent(new CustomEvent(OPEN_EXPORT_DIALOG_EVENT));
  };

  const handleUseTemplate = (
    templateId: TemplateDefinitionId,
    platformPresetId: PlatformPresetId
  ) => {
    createDocumentFromTemplate(templateId);
    setPlatformPreset(platformPresetId);
    navigateTo(APP_ROUTES.editor);
  };

  const handleStartFreeEdit = (platformPresetId: PlatformPresetId) => {
    createBlankDocument(platformPresetId);
    navigateTo(APP_ROUTES.editor);
  };

  const hasDraft = document.layers.length > 0;
  const isHelpOpen = route === APP_ROUTES.help;
  const isTemplateCenterOpen = route === APP_ROUTES.templates;

  const handleTemplateButtonClick = () => {
    if (isTemplateCenterOpen) {
      navigateTo(APP_ROUTES.editor);
      return;
    }

    navigateTo(APP_ROUTES.templates);
  };

  const handleHelpButtonClick = () => {
    if (isHelpOpen) {
      navigateTo(hasDraft ? APP_ROUTES.editor : APP_ROUTES.templates);
      return;
    }

    navigateTo(APP_ROUTES.help);
  };

  return (
    <MessageProvider>
      <div className="app-shell">
        <header className="app-shell__header">
          <div>
            <h1 className="eyebrow">Pic Boost</h1>
            <p className="workspace__meta">模板中心、帮助中心和编辑器现在使用独立路径，支持浏览器前进后退。</p>
          </div>
          <div className="app-shell__header-actions">
            <button className="app-shell__help-button" onClick={handleTemplateButtonClick} type="button">
              {isTemplateCenterOpen ? "返回编辑" : "模板页"}
            </button>
            <button className="app-shell__help-button" onClick={handleHelpButtonClick} type="button">
              {isHelpOpen ? "返回上一页" : "帮助页"}
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
          <HelpCenter onClose={() => navigateTo(hasDraft ? APP_ROUTES.editor : APP_ROUTES.templates)} />
        ) : isTemplateCenterOpen ? (
          <TemplateCenter
            activeTemplateName={document.templateMeta.templateName}
            hasDraft={hasDraft}
            onContinueDraft={() => navigateTo(APP_ROUTES.editor)}
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
