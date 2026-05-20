import { useEffect } from "react";
import { GLBModelViewer } from "./GLBModelViewer";

interface ModelPreviewDialogProps {
  modelUrl: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ModelPreviewDialog({ modelUrl, fileName, isOpen, onClose }: ModelPreviewDialogProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="model-preview-dialog__backdrop" onClick={onClose}>
      <div className="model-preview-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="model-preview-dialog__header">
          <div>
            <h3>3D 模型预览</h3>
            <p className="model-preview-dialog__filename">{fileName}</p>
          </div>
          <button
            className="model-preview-dialog__close"
            onClick={onClose}
            type="button"
            aria-label="关闭"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="model-preview-dialog__content">
          <GLBModelViewer modelUrl={modelUrl} />
        </div>
        <div className="model-preview-dialog__footer">
          <button className="model-preview-dialog__download" onClick={onClose} type="button">
            关闭预览
          </button>
        </div>
      </div>
    </div>
  );
}