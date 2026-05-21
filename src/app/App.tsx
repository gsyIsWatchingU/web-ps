import { useEffect, useState } from "react";
import { EditorWorkspace } from "../features/editor/components/EditorWorkspace";
import { HelpCenter } from "../features/editor/components/HelpCenter";
import { MessageProvider } from "../shared/message";

const EXPORT_STATE_EVENT = "editor:export-state";
const OPEN_EXPORT_DIALOG_EVENT = "editor:open-export-dialog";

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
