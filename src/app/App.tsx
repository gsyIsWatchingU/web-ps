import { useEffect, useState } from "react";
import { EditorWorkspace } from "../features/editor/components/EditorWorkspace";
import { HelpCenter } from "../features/editor/components/HelpCenter";

const EXPORT_REQUEST_EVENT = "editor:export-request";
const EXPORT_STATE_EVENT = "editor:export-state";

type ExportStateDetail = {
  isExporting: boolean;
};

export function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const handleExportState = (event: Event) => {
      const customEvent = event as CustomEvent<ExportStateDetail>;
      setIsExporting(Boolean(customEvent.detail?.isExporting));
    };

    window.addEventListener(EXPORT_STATE_EVENT, handleExportState as EventListener);
    return () => window.removeEventListener(EXPORT_STATE_EVENT, handleExportState as EventListener);
  }, []);

  const handleExportRequest = () => {
    window.dispatchEvent(new CustomEvent(EXPORT_REQUEST_EVENT));
  };

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div>
          <p className="eyebrow">Creative Editor</p>
          <h1>商品图精修工作台</h1>
          <p className="workspace__meta">
            面向正式业务场景的素材编辑界面，支持裁剪、文字、滤镜、局部修复和成品导出。
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
  );
}
