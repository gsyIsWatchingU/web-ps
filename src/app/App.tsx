import { useEffect, useState, useMemo } from "react";
import { EditorWorkspace } from "../features/editor/components/EditorWorkspace";
import { HelpCenter } from "../features/editor/components/HelpCenter";
import { MessageProvider } from "../shared/message";
import { useEditorStore } from "../features/editor/store/useEditorStore";
import { DownloadOutlined } from "@ant-design/icons";
import { Space } from "antd";
const EXPORT_STATE_EVENT = "editor:export-state";
const OPEN_EXPORT_DIALOG_EVENT = "editor:open-export-dialog";

type ExportStateDetail = {
  isExporting: boolean;
};

export function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessProductsOpen, setIsProcessProductsOpen] = useState(false);

  const { document } = useEditorStore();

  const processProducts = useMemo<Array<{
    type: "重绘原图" | "3D 模型";
    layerLabel: string;
    downloadUrl: string;
    fileName: string;
  }>>(() => {
    const products: Array<{
      type: "重绘原图" | "3D 模型";
      layerLabel: string;
      downloadUrl: string;
      fileName: string;
    }> = [];

    document.layers.forEach((layer, index) => {
      if (layer.type !== "image") return;

      if (layer.aiMeta.repairTask?.status === "succeeded" && layer.aiMeta.repairTask.downloadUrl) {
        products.push({
          type: "重绘原图",
          layerLabel: layer.name || `图层 ${index + 1}`,
          downloadUrl: layer.aiMeta.repairTask.downloadUrl,
          fileName: layer.aiMeta.repairTask.fileName || "repair-result.jpg"
        });
      }

      if (layer.aiMeta.model3dTask?.status === "succeeded" && layer.aiMeta.model3dTask.downloadUrl) {
        products.push({
          type: "3D 模型",
          layerLabel: layer.name || `图层 ${index + 1}`,
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

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleExportRequest = () => {
    window.dispatchEvent(new CustomEvent(OPEN_EXPORT_DIALOG_EVENT));
  };

  return (
    <MessageProvider>
      <div className="app-shell">
        <header className="app-shell__header">
          <div>
            <h1 className="eyebrow">Pic Boost</h1>
            <p className="workspace__meta">
              面向正式业务场景的素材编辑界面，支持裁剪、文字、滤镜、局部重绘和成品导出。
            </p>
          </div>
          <div className="app-shell__header-actions">
            <button
              className="app-shell__help-button"
              onClick={() => setIsHelpOpen((value) => !value)}
              type="button"
            >
              {isHelpOpen ? "返回编辑器" : "帮助"}
            </button>
            <div className="app-shell__process-products-dropdown">
              <button
                className="app-shell__process-products-button"
                type="button"
                onClick={() => setIsProcessProductsOpen(!isProcessProductsOpen)}
              >
                过程产物 ▾
              </button>
              {isProcessProductsOpen && (
                <div className="app-shell__dropdown-menu">
                  {processProducts.length === 0 ? (
                    <div className="app-shell__dropdown-empty">暂无过程产物</div>
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
                        <span className="app-shell__product-layer"><Space>{product.layerLabel}<DownloadOutlined /></Space></span>

                        {/* <span className="app-shell__product-filename">{product.fileName}</span> */}

                      </a>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              className="app-shell__primary-button"
              disabled={isExporting}
              onClick={handleExportRequest}
              type="button"
            >
              {isExporting ? "导出中..." : "导出成品"}
            </button>
          </div>
        </header>

        {isHelpOpen ? <HelpCenter onClose={() => setIsHelpOpen(false)} /> : <EditorWorkspace />}
      </div>
    </MessageProvider>
  );
}
