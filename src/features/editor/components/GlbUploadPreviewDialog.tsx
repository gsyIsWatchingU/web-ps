import { useCallback, useEffect, useRef, useState } from "react";
import { GLBModelViewer } from "./GLBModelViewer";

interface GlbUploadPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCEPTED_EXTENSIONS = [".glb", ".gltf", ".zip"];

function isValidFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function GlbUploadPreviewDialog({ isOpen, onClose }: GlbUploadPreviewDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewUrl("");
      setError(null);
      setIsDragOver(false);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    }
  }, [isOpen]);

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

  const handleFile = useCallback((file: File) => {
    if (!isValidFile(file)) {
      setError(`不支持的文件格式。请上传 ${ACCEPTED_EXTENSIONS.join("、")} 格式的文件。`);
      setSelectedFile(null);
      setPreviewUrl("");
      return;
    }

    setError(null);
    setSelectedFile(file);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);

      const file = event.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      event.target.value = "";
    },
    [handleFile]
  );

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <div className="model-preview-dialog__backdrop" onClick={onClose}>
      <div className="glb-upload-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="model-preview-dialog__header">
          <div>
            <h3>3D 模型预览</h3>
            {selectedFile && (
              <p className="model-preview-dialog__filename">{selectedFile.name}</p>
            )}
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

        <div className="glb-upload-dialog__content">
          {previewUrl ? (
            <div className="glb-upload-dialog__preview">
              <GLBModelViewer modelUrl={previewUrl} />
            </div>
          ) : (
            <div
              className={`glb-upload-dialog__dropzone ${isDragOver ? "glb-upload-dialog__dropzone--active" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleSelectClick}
            >
              <input
                ref={fileInputRef}
                accept=".glb,.gltf,.zip"
                className="glb-upload-dialog__file-input"
                onChange={handleFileSelect}
                type="file"
              />
              <div className="glb-upload-dialog__dropzone-content">
                <svg className="glb-upload-dialog__upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 16V4m0 0L8 8m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" strokeLinecap="round" />
                </svg>
                <p className="glb-upload-dialog__dropzone-text">
                  拖拽 .glb / .gltf / .zip 文件到此处
                </p>
                <p className="glb-upload-dialog__dropzone-hint">或点击选择文件</p>
                <p className="glb-upload-dialog__supported-formats">
                  支持格式：.glb、.gltf、.zip（含 glb/gltf）
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="glb-upload-dialog__error">
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="model-preview-dialog__footer">
          {previewUrl ? (
            <>
              <button
                className="glb-upload-dialog__action-button"
                onClick={() => {
                  if (blobUrlRef.current) {
                    URL.revokeObjectURL(blobUrlRef.current);
                    blobUrlRef.current = null;
                  }
                  setSelectedFile(null);
                  setPreviewUrl("");
                }}
                type="button"
              >
                重新选择
              </button>
              <button
                className="model-preview-dialog__download"
                onClick={onClose}
                type="button"
              >
                关闭预览
              </button>
            </>
          ) : (
            <button
              className="glb-upload-dialog__action-button"
              onClick={onClose}
              type="button"
            >
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
