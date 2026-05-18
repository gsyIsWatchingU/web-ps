import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  canvasBackgroundModes,
  canvasPresets,
  enhanceProfiles,
  imageFilterPresets,
  layerTypeLabels,
  textTemplatePresets,
  type CanvasPresetId,
  type DecorationLayer,
  type DoodleLayer,
  type EditorDocument,
  type EditorLayer,
  type ExportSizePreset,
  type ImageCrop,
  type TextLayer
} from "../model/document";
import { hasAiConfig } from "../runtime/aiConfig";
import { exportDocument } from "../runtime/exportDocument";
import { useEditorStore } from "../store/useEditorStore";
import { CanvasViewport } from "./CanvasViewport";
import { useMessage } from "../../../shared/message";

const EXPORT_STATE_EVENT = "editor:export-state";
const OPEN_EXPORT_DIALOG_EVENT = "editor:open-export-dialog";

const exportSizePresetOptions: Array<{
  value: ExportSizePreset;
  label: string;
}> = [
    { value: "group", label: "原比例" },
    { value: "free", label: "自由比例" },
    { value: "1inch", label: "1寸" },
    { value: "2inch", label: "2寸" }
  ];

const fixedSizeDimensions = {
  "1inch": { width: 295, height: 413 },
  "2inch": { width: 413, height: 579 }
} as const;

const toolItemsV2 = [
  { id: "select", label: "选择", hint: "选中图层并继续调整位置、透明度和层级", icon: "▣" },
  { id: "hand", label: "平移", hint: "拖动画布视口，查看局部细节", icon: "✥" },
  { id: "crop", label: "裁剪", hint: "进入裁剪模式，调整构图和比例", icon: "✂" },
  { id: "doodle", label: "涂鸦", hint: "手绘标记内容，生成可编辑涂鸦图层", icon: "✎" },
  { id: "brush", label: "圈选修复", hint: "圈出需要 AI 修复的局部区域", icon: "◌" },
  { id: "eraser", label: "擦除圈选", hint: "擦掉多选或误选的修复区域", icon: "⌫" },
  { id: "repair", label: "执行修复", hint: "对当前圈选区域执行 AI 局部修复", icon: "✦" },
  { id: "text", label: "文字", hint: "添加标题、价格和卖点文案", icon: "T" },
  { id: "filter", label: "滤镜", hint: "套用预设滤镜并微调画面质感", icon: "◐" },
  { id: "shape", label: "装饰", hint: "添加徽章、贴片和强调色块", icon: "◆" }
] as const;

const cropAspectOptions: Array<{ label: string; value: number | null }> = [
  { label: "原始比例", value: null },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "9:16", value: 9 / 16 }
];

const decorationShapeOptions: Array<{
  value: DecorationLayer["shape"];
  label: string;
}> = [
    { value: "highlight", label: "高亮条" },
    { value: "badge", label: "徽章" },
    { value: "ribbon", label: "缎带" }
  ];

const fontWeightOptions: Array<{
  value: TextLayer["style"]["fontWeight"];
  label: string;
}> = [
    { value: 500, label: "中等" },
    { value: 700, label: "加粗" },
    { value: 800, label: "特粗" }
  ];

type ToolId = Exclude<(typeof toolItemsAntd)[number]["id"], "hand">;
type LeftSidebarTab = "canvas" | "tools" | "layers";
type RightSidebarTab = "tool" | "layer";

function getSelectedImageLayer(layer: EditorLayer | undefined) {
  return layer?.type === "image" ? layer : null;
}

function getSelectedTextLayer(layer: EditorLayer | undefined) {
  return layer?.type === "text" ? layer : null;
}

function getSelectedDecorationLayer(layer: EditorLayer | undefined) {
  return layer?.type === "decoration" ? layer : null;
}

function getSelectedDoodleLayer(layer: EditorLayer | undefined) {
  return layer?.type === "doodle" ? layer : null;
}

function formatTime(timestamp: string | null) {
  if (!timestamp) {
    return "暂无";
  }

  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function clampDimension(value: number) {
  return Math.min(8000, Math.max(1, Math.round(value)));
}

function renderLayerStatusChips(layer: EditorLayer, isSelected = false) {
  return (
    <div className="workspace__layer-meta">
      {/* {isSelected ? <span className="workspace__chip workspace__chip--accent">当前图层</span> : null} */}
      <span className="workspace__chip">{layerTypeLabels[layer.type]}</span>
      <span className={`workspace__chip ${layer.visible ? "workspace__chip--success" : "workspace__chip--muted"}`}>
        {layer.visible ? "显示中" : "已隐藏"}
      </span>
      <span className={`workspace__chip ${layer.locked ? "workspace__chip--warning" : "workspace__chip--success"}`}>
        {layer.locked ? "已锁定" : "可编辑"}
      </span>
      <span className="workspace__chip">Z{layer.zIndex}</span>
    </div>
  );
}

function getGroupHeight(width: number, canvasWidth: number, canvasHeight: number) {
  return clampDimension((width * canvasHeight) / canvasWidth);
}

function getGroupWidth(height: number, canvasWidth: number, canvasHeight: number) {
  return clampDimension((height * canvasWidth) / canvasHeight);
}

function getScaledDimensions(canvasWidth: number, canvasHeight: number, scalePercent: number) {
  const ratio = scalePercent / 100;

  return {
    width: clampDimension(canvasWidth * ratio),
    height: clampDimension(canvasHeight * ratio)
  };
}

const IMAGE_REQUIRED_TOOLS: ToolId[] = ["crop", "brush", "eraser", "repair", "filter"];

function buildPersistedDraft(document: EditorDocument, savedAt: string): EditorDocument {
  return {
    ...document,
    layers: document.layers.map((layer) =>
      layer.type === "image"
        ? {
          ...layer,
          mask: {
            ...layer.mask,
            strokes: [],
            activeStrokeId: null
          }
        }
        : layer
    ),
    draftMeta: {
      ...document.draftMeta,
      lastSavedAt: savedAt
    }
  };
}

function buildCropDraftFromAspect(
  originalWidth: number,
  originalHeight: number,
  aspectRatio: number | null
) {
  if (!aspectRatio) {
    return {
      x: 0,
      y: 0,
      width: originalWidth,
      height: originalHeight
    } satisfies ImageCrop;
  }

  const originalRatio = originalWidth / originalHeight;
  let width = originalWidth;
  let height = originalHeight;

  if (originalRatio > aspectRatio) {
    width = Math.round(height * aspectRatio);
  } else {
    height = Math.round(width / aspectRatio);
  }

  return {
    x: Math.round((originalWidth - width) / 2),
    y: Math.round((originalHeight - height) / 2),
    width,
    height
  } satisfies ImageCrop;
}

function Tooltip({ children }: { children: ReactNode }) {
  return <span className="workspace__tooltip">{children}</span>;
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" className="workspace__antd-icon" viewBox="0 0 24 24" fill="none">
      {children}
    </svg>
  );
}

const toolItemsAntd = [
  {
    id: "select",
    label: "选择",
    hint: "选中图层并继续调整位置、透明度和层级",
    icon: (
      <IconBase>
        <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M17 9h4M3 15h4M17 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </IconBase>
    )
  },
  {
    id: "hand",
    label: "平移",
    hint: "拖动画布视口，查看局部细节",
    icon: (
      <IconBase>
        <path d="M8 12V7a1.5 1.5 0 0 1 3 0v3m0 2V6.5a1.5 1.5 0 0 1 3 0V12m0-1.5a1.5 1.5 0 0 1 3 0v2.5c0 4-2.4 7-6 7-4 0-7-2.9-7-6.8V11a1.5 1.5 0 0 1 3 0v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </IconBase>
    )
  },
  {
    id: "crop",
    label: "裁剪",
    hint: "进入裁剪模式，调整构图和比例",
    icon: (
      <IconBase>
        <path d="M8 4v11a3 3 0 0 0 3 3h9M4 8h11a3 3 0 0 1 3 3v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      </IconBase>
    )
  },
  {
    id: "doodle",
    label: "涂鸦",
    hint: "手绘标记内容，生成可编辑涂鸦图层",
    icon: (
      <IconBase>
        <path d="M5 16c3.5-6.5 6.5-9.5 12-11l2 2c-1.5 5.5-4.5 8.5-11 12H5v-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </IconBase>
    )
  },
  {
    id: "brush",
    label: "圈选修复",
    hint: "圈出需要 AI 修复的局部区域",
    icon: (
      <IconBase>
        <path d="M8 18c0 1.7-1.3 3-3 3 1.7 0 3-1.3 3-3 0-1-.5-1.8-1.2-2.3L14.5 8a2.5 2.5 0 1 1 3.5 3.5l-7.7 7.7c-.5-.7-1.3-1.2-2.3-1.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </IconBase>
    )
  },
  {
    id: "eraser",
    label: "擦除圈选",
    hint: "擦掉多选或误选的修复区域",
    icon: (
      <IconBase>
        <path d="M8 7.5 15.5 15a2 2 0 0 1 0 2.8l-1.7 1.7a2 2 0 0 1-2.8 0L4.2 12.7a2 2 0 0 1 0-2.8L7 7.1a2 2 0 0 1 1-.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 20h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </IconBase>
    )
  },
  {
    id: "repair",
    label: "执行修复",
    hint: "对当前圈选区域执行 AI 局部修复",
    icon: (
      <IconBase>
        <path d="m12 3 1.8 4.8L19 9.6l-4.1 2.8L16.4 18 12 14.8 7.6 18l1.5-5.6L5 9.6l5.2-1.8L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </IconBase>
    )
  },
  {
    id: "text",
    label: "文字",
    hint: "添加标题、价格和卖点文案",
    icon: (
      <IconBase>
        <path d="M6 6h12M12 6v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9 18h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </IconBase>
    )
  },
  {
    id: "filter",
    label: "滤镜",
    hint: "套用预设滤镜并微调画面质感",
    icon: (
      <IconBase>
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 5a7 7 0 0 1 0 14V5Z" fill="currentColor" opacity="0.22" />
      </IconBase>
    )
  },
  {
    id: "shape",
    label: "装饰",
    hint: "添加徽章、贴片和强调色块",
    icon: (
      <IconBase>
        <path d="M12 4 19 9v6l-7 5-7-5V9l7-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 8.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </IconBase>
    )
  }
] as const;

export function EditorWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const message = useMessage();
  const [isExporting, setIsExporting] = useState(false);
  const [aiBusy, setAiBusy] = useState<"repair" | "extend" | null>(null);
  const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>("tools");
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>("tool");
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [lastExportedFilename, setLastExportedFilename] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const {
    activeTool,
    cropSession,
    addDecorationLayer,
    addDoodleLayer,
    addTextLayer,
    applyAiExtend,
    applyAiRepair,
    applyEnhanceProfile,
    applyImagePreset,
    applyTextTemplate,
    centerLayer,
    clearMask,
    clearCanvas,
    commitCropSession,
    document,
    duplicateLayer,
    historyPast,
    importImage,
    recordWorkflowExport,
    moveLayer,
    redo,
    removeLayer,
    resetImageAdjustments,
    resetImageCrop,
    selectedLayerIds,
    selectLayer,
    setActiveTool,
    setCanvasPreset,
    setCanvasDisplayBackground,
    setCanvasViewport,
    setImageCropAspect,
    setSelectedLayerIds,
    startCropSession,
    startMaskStroke,
    appendMaskPoint,
    finishMaskStroke,
    toggleLayerLock,
    toggleLayerVisibility,
    cancelCropSession,
    undo,
    updateAiExpandPrompt,
    updateAiPrompt,
    updateCropSession,
    updateDecorationFill,
    updateDecorationShape,
    updateDoodleStyle,
    updateExportConfig,
    updateImageFilters,
    updateLayerName,
    updateLayerOpacity,
    updateLayerTransform,
    updateMaskBrushSize,
    toggleMaskPreview,
    updateTextContent,
    updateTextStyle
  } = useEditorStore();

  const selectedLayer = useMemo(
    () => document.layers.find((layer) => selectedLayerIds.includes(layer.id)),
    [document.layers, selectedLayerIds]
  );
  const selectedImageLayer = getSelectedImageLayer(selectedLayer);
  const selectedTextLayer = getSelectedTextLayer(selectedLayer);
  const selectedDecorationLayer = getSelectedDecorationLayer(selectedLayer);
  const selectedDoodleLayer = getSelectedDoodleLayer(selectedLayer);
  const activeToolItem = toolItemsAntd.find((tool) => tool.id === activeTool);
  const canUndo = historyPast.length > 0;
  const viewport = document.canvas.viewport;
  const canvasDisplayBackground = document.canvas.displayBackground;
  const aiConfigured = hasAiConfig();
  const activeCropDraft =
    cropSession && selectedImageLayer && cropSession.layerId === selectedImageLayer.id
      ? cropSession.draft
      : selectedImageLayer?.crop ?? null;
  const isFixedSizePreset =
    document.exportConfig.sizePreset === "1inch" || document.exportConfig.sizePreset === "2inch";
  const isAspectLocked = document.exportConfig.sizePreset === "group";
  const scaledDimensions = getScaledDimensions(
    document.canvas.width,
    document.canvas.height,
    document.exportConfig.scalePercent
  );
  const showCropProperties = activeTool === "crop" && selectedImageLayer !== null;
  const activeToolNeedsImageLayer = IMAGE_REQUIRED_TOOLS.includes(activeTool);

  const requireSelectedImageLayer = (toolId: ToolId) => {
    if (!IMAGE_REQUIRED_TOOLS.includes(toolId)) {
      return true;
    }

    if (selectedImageLayer) {
      return true;
    }

    message.warning("请先选中图片图层，再使用这个工具。");
    return false;
  };

  useEffect(() => {
    setLastAutoSavedAt(document.draftMeta.lastSavedAt);
  }, [document.draftMeta.lastSavedAt]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(EXPORT_STATE_EVENT, {
        detail: { isExporting }
      })
    );
  }, [isExporting]);

  useEffect(() => {
    if (!document.draftMeta.enabled) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        window.localStorage.setItem(
          document.draftMeta.storageKey,
          JSON.stringify(buildPersistedDraft(document, savedAt))
        );
        setLastAutoSavedAt(savedAt);
      } catch {
        // Ignore storage failures in private mode or quota limited environments.
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [document]);

  useEffect(() => {
    if (activeTool === "crop" && selectedImageLayer) {
      if (!cropSession || cropSession.layerId !== selectedImageLayer.id) {
        startCropSession(selectedImageLayer.id);
      }
    }
  }, [activeTool, cropSession, selectedImageLayer, startCropSession]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;

      if (!isMeta) {
        return;
      }

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if (
        event.key.toLowerCase() === "y" ||
        (event.key.toLowerCase() === "z" && event.shiftKey)
      ) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redo, undo]);

  const handleImportClick = () => {
    setLeftSidebarTab("layers");
    fileInputRef.current?.click();
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await importImage(file);
    setFeedbackMessage(`已导入 ${file.name}`);
    event.target.value = "";
  };

  const handleExport = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    setFeedbackMessage(null);

    try {
      const result = await exportDocument(document);
      recordWorkflowExport();
      setLastExportedFilename(result.filename);
      setFeedbackMessage(`已导出 ${result.filename}`);
      setIsExportDialogOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const handleOpenExportDialog = () => {
      setIsExportDialogOpen(true);
    };

    window.addEventListener(OPEN_EXPORT_DIALOG_EVENT, handleOpenExportDialog);
    return () => window.removeEventListener(OPEN_EXPORT_DIALOG_EVENT, handleOpenExportDialog);
  }, []);

  const handleClearCanvas = () => {
    const confirmed = window.confirm("确认清空当前画布吗？该操作不可逆。");

    if (!confirmed) {
      return;
    }

    clearCanvas();
    setLeftSidebarTab("tools");
    setRightSidebarTab("layer");
    setFeedbackMessage("画布已清空。");
  };

  const handleAiRepair = async () => {
    if (!requireSelectedImageLayer("repair")) {
      return;
    }

    const imageLayer = selectedImageLayer;

    if (!imageLayer) {
      return;
    }

    setAiBusy("repair");
    setFeedbackMessage(null);

    try {
      const result = await applyAiRepair(imageLayer.id);
      setFeedbackMessage(result.success ? "AI 局部修复已完成。" : result.errorMessage);
    } finally {
      setAiBusy(null);
    }
  };

  const handleAiExtend = async (presetId: CanvasPresetId) => {
    if (!requireSelectedImageLayer("repair")) {
      return;
    }

    const imageLayer = selectedImageLayer;

    if (!imageLayer) {
      return;
    }

    setAiBusy("extend");
    setFeedbackMessage(null);

    try {
      const result = await applyAiExtend(imageLayer.id, presetId);
      setFeedbackMessage(result.success ? `已完成 ${presetId} 比例的 AI 扩图。` : result.errorMessage);
    } finally {
      setAiBusy(null);
    }
  };

  const handleCropAspect = (aspectRatio: number | null) => {
    if (!selectedImageLayer) {
      return;
    }

    if (activeTool === "crop") {
      updateCropSession(
        buildCropDraftFromAspect(
          selectedImageLayer.originalWidth,
          selectedImageLayer.originalHeight,
          aspectRatio
        )
      );
      return;
    }

    setImageCropAspect(selectedImageLayer.id, aspectRatio);
  };

  const handleCropReset = () => {
    if (!selectedImageLayer) {
      return;
    }

    if (activeTool === "crop") {
      updateCropSession({
        x: 0,
        y: 0,
        width: selectedImageLayer.originalWidth,
        height: selectedImageLayer.originalHeight
      });
      return;
    }

    resetImageCrop(selectedImageLayer.id);
  };

  const handleToolClick = (toolId: ToolId) => {
    setLeftSidebarTab("tools");
    setRightSidebarTab("tool");

    if (!requireSelectedImageLayer(toolId)) {
      return;
    }

    if (toolId === "repair") {
      void handleAiRepair();
      return;
    }

    setFeedbackMessage(null);
    setActiveTool(toolId);
  };

  const handleExportSizePresetChange = (preset: ExportSizePreset) => {
    if (preset === "1inch" || preset === "2inch") {
      updateExportConfig({
        sizePreset: preset,
        width: fixedSizeDimensions[preset].width,
        height: fixedSizeDimensions[preset].height
      });
      return;
    }

    if (preset === "group") {
      updateExportConfig({
        sizePreset: preset,
        width: document.canvas.width,
        height: document.canvas.height
      });
      return;
    }

    updateExportConfig({
      sizePreset: preset
    });
  };

  const handleFixedWidthChange = (value: number) => {
    const width = clampDimension(value);

    if (isAspectLocked) {
      updateExportConfig({
        width,
        height: getGroupHeight(width, document.canvas.width, document.canvas.height)
      });
      return;
    }

    updateExportConfig({ width });
  };

  const handleFixedHeightChange = (value: number) => {
    const height = clampDimension(value);

    if (isAspectLocked) {
      updateExportConfig({
        width: getGroupWidth(height, document.canvas.width, document.canvas.height),
        height
      });
      return;
    }

    updateExportConfig({ height });
  };

  const handleScalePercentChange = (value: number) => {
    updateExportConfig({
      scalePercent: Math.min(300, Math.max(10, Math.round(value)))
    });
  };

  const handleScaleWidthChange = (value: number) => {
    const width = clampDimension(value);
    handleScalePercentChange((width / document.canvas.width) * 100);
  };

  const handleScaleHeightChange = (value: number) => {
    const height = clampDimension(value);
    handleScalePercentChange((height / document.canvas.height) * 100);
  };

  const handleExportLockToggle = () => {
    if (isFixedSizePreset) {
      return;
    }

    if (isAspectLocked) {
      updateExportConfig({ sizePreset: "free" });
      return;
    }

    updateExportConfig({
      sizePreset: "group",
      height: getGroupHeight(
        document.exportConfig.width,
        document.canvas.width,
        document.canvas.height
      )
    });
  };

  const renderToolProperties = () => {
    if (activeToolNeedsImageLayer && !selectedImageLayer) {
      return (
        <div className="workspace__property-list">
          <div className="workspace__property workspace__property--highlight">
            <div className="workspace__property-label">请先选择图片图层</div>
            <p className="workspace__footer-note">
              裁剪、圈选修复、擦除圈选、执行修复和滤镜都需要先选中一个图片图层，右侧才能继续编辑。
            </p>
            <div className="workspace__inline-actions">
              <button
                className="workspace__action-button"
                onClick={() => {
                  setLeftSidebarTab("layers");
                  setRightSidebarTab("layer");
                }}
                type="button"
              >
                去图层列表选择
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (selectedImageLayer) {
      return (
        <div className="workspace__property-list">
          {showCropProperties ? (
            <div className="workspace__property">
              <div className="workspace__property-label">应用裁剪</div>
              <div className="workspace__inline-actions">
                {cropAspectOptions.map((option) => (
                  <button
                    key={option.label}
                    className="workspace__action-button"
                    onClick={() => handleCropAspect(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {activeCropDraft ? (
                <p className="workspace__footer-note">
                  当前裁剪：{activeCropDraft.width} × {activeCropDraft.height}
                </p>
              ) : null}
              <div className="workspace__inline-actions">
                <button className="workspace__action-button" onClick={commitCropSession} type="button">
                  应用
                </button>
                <button className="workspace__action-button" onClick={cancelCropSession} type="button">
                  关闭
                </button>
                <button className="workspace__action-button" onClick={handleCropReset} type="button">
                  重置
                </button>
              </div>
            </div>
          ) : null}

          <div className="workspace__property">
            <div className="workspace__property-label">滤镜预设</div>
            <div className="workspace__tool-stack">
              {imageFilterPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={`workspace__tool-button workspace__tool-button--stack ${selectedImageLayer.presetFilterId === preset.id ? "is-active" : ""
                    }`}
                  onClick={() => applyImagePreset(selectedImageLayer.id, preset.id)}
                  type="button"
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="workspace__property">
            <div className="workspace__property-label">快速增强</div>
            <div className="workspace__inline-actions">
              {enhanceProfiles.map((profile) => (
                <button
                  key={profile.id}
                  className="workspace__action-button"
                  onClick={() => applyEnhanceProfile(selectedImageLayer.id, profile.id)}
                  type="button"
                >
                  {profile.label}
                </button>
              ))}
              <button
                className="workspace__action-button"
                onClick={() => resetImageAdjustments(selectedImageLayer.id)}
                type="button"
              >
                重置调整
              </button>
            </div>
          </div>

          {(
            [
              ["brightness", "亮度", -1, 1, 0.01],
              ["contrast", "对比度", -1, 1, 0.01],
              ["saturation", "饱和度", -1, 1, 0.01],
              ["blur", "模糊", 0, 1, 0.01],
              ["sharpen", "锐化", 0, 1, 0.01],
              ["temperature", "色温", -1, 1, 0.01]
            ] as const
          ).map(([key, label, min, max, step]) => (
            <label className="workspace__property" key={key}>
              <span className="workspace__property-label">{label}</span>
              <input
                className="workspace__range"
                max={max}
                min={min}
                onChange={(event) =>
                  updateImageFilters(selectedImageLayer.id, {
                    [key]: Number(event.target.value)
                  })
                }
                step={step}
                type="range"
                value={selectedImageLayer.filters[key]}
              />
              <div className="workspace__property-value">{selectedImageLayer.filters[key].toFixed(2)}</div>
            </label>
          ))}

          <div className="workspace__property">
            <div className="workspace__property-label">AI 局部修复</div>
            <p className="workspace__footer-note">
              先使用圈选工具标出需要处理的区域，再填写修复提示词并执行局部修复。
            </p>
            {!aiConfigured ? (
              <p className="workspace__warning">
                请先在 `src/features/editor/runtime/aiConfig.ts` 中配置 API Key 和 Base URL。
              </p>
            ) : null}
            <label className="workspace__property workspace__property--inner">
              <span className="workspace__property-label">修复提示词</span>
              <textarea
                className="workspace__text-area"
                onChange={(event) => updateAiPrompt(selectedImageLayer.id, event.target.value)}
                rows={3}
                value={selectedImageLayer.aiMeta.prompt}
              />
            </label>
            <label className="workspace__property workspace__property--inner">
              <span className="workspace__property-label">圈选笔刷大小</span>
              <input
                className="workspace__range"
                max={160}
                min={8}
                onChange={(event) => updateMaskBrushSize(selectedImageLayer.id, Number(event.target.value))}
                step={1}
                type="range"
                value={selectedImageLayer.mask.brushSize}
              />
              <div className="workspace__property-value">{selectedImageLayer.mask.brushSize}px</div>
            </label>
            <div className="workspace__inline-actions">
              <button
                className="workspace__action-button"
                onClick={() => toggleMaskPreview(selectedImageLayer.id)}
                type="button"
              >
                {selectedImageLayer.mask.showPreview ? "隐藏圈选预览" : "显示圈选预览"}
              </button>
              <button className="workspace__action-button" onClick={() => clearMask(selectedImageLayer.id)} type="button">
                清空圈选
              </button>
              <button
                className="workspace__action-button"
                disabled={aiBusy !== null || !aiConfigured}
                onClick={() => void handleAiRepair()}
                type="button"
              >
                {aiBusy === "repair" ? "处理中..." : "执行 AI 修复"}
              </button>
            </div>
            <p className="workspace__footer-note">
              最近 AI 动作：{selectedImageLayer.aiMeta.lastAiAction ?? "暂无"} · 最近成功：
              {formatTime(selectedImageLayer.aiMeta.lastAiSucceededAt)}
            </p>
            {selectedImageLayer.aiMeta.lastAiError ? (
              <p className="workspace__warning">{selectedImageLayer.aiMeta.lastAiError}</p>
            ) : null}
          </div>

          <div className="workspace__property">
            <div className="workspace__property-label">AI 扩图</div>
            <label className="workspace__property workspace__property--inner">
              <span className="workspace__property-label">扩图提示词</span>
              <textarea
                className="workspace__text-area"
                onChange={(event) => updateAiExpandPrompt(selectedImageLayer.id, event.target.value)}
                rows={3}
                value={selectedImageLayer.aiMeta.expandPrompt}
              />
            </label>
            <div className="workspace__inline-actions">
              {(["1:1", "4:5", "9:16"] as CanvasPresetId[]).map((presetId) => (
                <button
                  key={presetId}
                  className="workspace__action-button"
                  disabled={aiBusy !== null || !aiConfigured}
                  onClick={() => void handleAiExtend(presetId)}
                  type="button"
                >
                  {aiBusy === "extend" ? "扩图中..." : `扩展到 ${presetId}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (selectedTextLayer) {
      return (
        <div className="workspace__property-list">
          <div className="workspace__property">
            <div className="workspace__property-label">文字模板</div>
            <div className="workspace__tool-stack">
              {textTemplatePresets.map((template) => (
                <button
                  key={template.id}
                  className={`workspace__tool-button workspace__tool-button--stack ${selectedTextLayer.textTemplateId === template.id ? "is-active" : ""
                    }`}
                  onClick={() => applyTextTemplate(selectedTextLayer.id, template.id)}
                  type="button"
                >
                  <strong>{template.label}</strong>
                  <span>{template.content}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="workspace__property">
            <span className="workspace__property-label">文字内容</span>
            <textarea
              className="workspace__text-area"
              onChange={(event) => updateTextContent(selectedTextLayer.id, event.target.value)}
              rows={3}
              value={selectedTextLayer.content}
            />
          </label>
          <label className="workspace__property">
            <span className="workspace__property-label">字号</span>
            <input
              className="workspace__range"
              max={120}
              min={24}
              onChange={(event) =>
                updateTextStyle(selectedTextLayer.id, {
                  fontSize: Number(event.target.value)
                })
              }
              step={1}
              type="range"
              value={selectedTextLayer.style.fontSize}
            />
            <div className="workspace__property-value">{selectedTextLayer.style.fontSize}px</div>
          </label>
          <label className="workspace__property">
            <span className="workspace__property-label">字重</span>
            <select
              className="workspace__select"
              onChange={(event) =>
                updateTextStyle(selectedTextLayer.id, {
                  fontWeight: Number(event.target.value)
                })
              }
              value={selectedTextLayer.style.fontWeight}
            >
              {fontWeightOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="workspace__swatch-grid">
            <label className="workspace__swatch-field">
              <span>文字颜色</span>
              <input
                className="workspace__color-input"
                onChange={(event) =>
                  updateTextStyle(selectedTextLayer.id, {
                    fill: event.target.value
                  })
                }
                type="color"
                value={selectedTextLayer.style.fill}
              />
            </label>
            <label className="workspace__swatch-field">
              <span>描边颜色</span>
              <input
                className="workspace__color-input"
                onChange={(event) =>
                  updateTextStyle(selectedTextLayer.id, {
                    stroke: event.target.value
                  })
                }
                type="color"
                value={selectedTextLayer.style.stroke}
              />
            </label>
          </div>
        </div>
      );
    }

    if (selectedDecorationLayer) {
      return (
        <div className="workspace__property-list">
          <label className="workspace__property">
            <span className="workspace__property-label">装饰形状</span>
            <select
              className="workspace__select"
              onChange={(event) =>
                updateDecorationShape(
                  selectedDecorationLayer.id,
                  event.target.value as DecorationLayer["shape"]
                )
              }
              value={selectedDecorationLayer.shape}
            >
              {decorationShapeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="workspace__property">
            <span className="workspace__property-label">填充颜色</span>
            <input
              className="workspace__color-input workspace__color-input--wide"
              onChange={(event) => updateDecorationFill(selectedDecorationLayer.id, event.target.value)}
              type="color"
              value={selectedDecorationLayer.fill}
            />
          </label>
        </div>
      );
    }

    if (selectedDoodleLayer) {
      return (
        <div className="workspace__property-list">
          <label className="workspace__property">
            <span className="workspace__property-label">涂鸦颜色</span>
            <input
              className="workspace__color-input workspace__color-input--wide"
              onChange={(event) =>
                updateDoodleStyle(selectedDoodleLayer.id, {
                  stroke: event.target.value
                })
              }
              type="color"
              value={selectedDoodleLayer.stroke}
            />
          </label>
          <label className="workspace__property">
            <span className="workspace__property-label">笔触粗细</span>
            <input
              className="workspace__range"
              max={64}
              min={2}
              onChange={(event) =>
                updateDoodleStyle(selectedDoodleLayer.id, {
                  strokeWidth: Number(event.target.value)
                })
              }
              step={1}
              type="range"
              value={selectedDoodleLayer.strokeWidth}
            />
            <div className="workspace__property-value">{selectedDoodleLayer.strokeWidth}px</div>
          </label>
        </div>
      );
    }

    return (
      <div className="workspace__empty-state">
        <p className="workspace__empty">当前未选中图层。</p>
        <p className="workspace__footer-note">
          {activeToolItem
            ? `当前工具：${activeToolItem.label}。${activeToolItem.hint}`
            : "从左侧图层列表中选中一个图层后，这里会显示对应工具属性。"}
        </p>
      </div>
    );
  };

  const renderLayerProperties = () => {
    if (!selectedLayer) {
      return (
        <div className="workspace__empty-state">
          <p className="workspace__empty">未选中图层</p>
          <p className="workspace__footer-note">先从左侧图层列表中选中一个图层，再继续调整名称、透明度和位置。</p>
        </div>
      );
    }

    return (
      <div className="workspace__property-list">
        <div className="workspace__property workspace__property--highlight">
          <div className="workspace__property-label">当前图层状态</div>
          {renderLayerStatusChips(selectedLayer, true)}
          <div className="workspace__inline-actions">
            <button
              className="workspace__action-button"
              onClick={() => toggleLayerVisibility(selectedLayer.id)}
              type="button"
            >
              {selectedLayer.visible ? "隐藏图层" : "显示图层"}
            </button>
            <button
              className="workspace__action-button"
              onClick={() => toggleLayerLock(selectedLayer.id)}
              type="button"
            >
              {selectedLayer.locked ? "解锁图层" : "锁定图层"}
            </button>
            <button className="workspace__action-button" onClick={() => moveLayer(selectedLayer.id, "up")} type="button">
              上移一层
            </button>
            <button className="workspace__action-button" onClick={() => moveLayer(selectedLayer.id, "down")} type="button">
              下移一层
            </button>
          </div>
        </div>
        <label className="workspace__property">
          <span className="workspace__property-label">图层名称</span>
          <input
            className="workspace__text-input"
            onChange={(event) => updateLayerName(selectedLayer.id, event.target.value)}
            type="text"
            value={selectedLayer.name}
          />
        </label>
        <label className="workspace__property">
          <span className="workspace__property-label">不透明度</span>
          <input
            className="workspace__range"
            max={1}
            min={0}
            onChange={(event) => updateLayerOpacity(selectedLayer.id, Number(event.target.value))}
            step={0.01}
            type="range"
            value={selectedLayer.opacity}
          />
          <div className="workspace__property-value">{Math.round(selectedLayer.opacity * 100)}%</div>
        </label>
        <div className="workspace__property-grid">
          <label className="workspace__property">
            <span className="workspace__property-label">X</span>
            <input
              className="workspace__range"
              max={document.canvas.width}
              min={0}
              onChange={(event) =>
                updateLayerTransform(selectedLayer.id, {
                  x: Number(event.target.value)
                })
              }
              step={1}
              type="range"
              value={selectedLayer.transform.x}
            />
            <div className="workspace__property-value">{Math.round(selectedLayer.transform.x)}px</div>
          </label>
          <label className="workspace__property">
            <span className="workspace__property-label">Y</span>
            <input
              className="workspace__range"
              max={document.canvas.height}
              min={0}
              onChange={(event) =>
                updateLayerTransform(selectedLayer.id, {
                  y: Number(event.target.value)
                })
              }
              step={1}
              type="range"
              value={selectedLayer.transform.y}
            />
            <div className="workspace__property-value">{Math.round(selectedLayer.transform.y)}px</div>
          </label>
        </div>
        <div className="workspace__property-grid">
          <label className="workspace__property">
            <span className="workspace__property-label">缩放</span>
            <input
              className="workspace__range"
              max={3}
              min={0.2}
              onChange={(event) => {
                const nextScale = Number(event.target.value);
                updateLayerTransform(selectedLayer.id, {
                  scaleX: nextScale,
                  scaleY: nextScale
                });
              }}
              step={0.01}
              type="range"
              value={selectedLayer.transform.scaleX}
            />
            <div className="workspace__property-value">{selectedLayer.transform.scaleX.toFixed(2)}x</div>
          </label>
          <label className="workspace__property">
            <span className="workspace__property-label">旋转</span>
            <input
              className="workspace__range"
              max={180}
              min={-180}
              onChange={(event) =>
                updateLayerTransform(selectedLayer.id, {
                  rotation: Number(event.target.value)
                })
              }
              step={1}
              type="range"
              value={selectedLayer.transform.rotation}
            />
            <div className="workspace__property-value">{Math.round(selectedLayer.transform.rotation)}°</div>
          </label>
        </div>
        <div className="workspace__inline-actions">
          <button className="workspace__action-button" onClick={() => centerLayer(selectedLayer.id, "horizontal")} type="button">
            水平居中
          </button>
          <button className="workspace__action-button" onClick={() => centerLayer(selectedLayer.id, "vertical")} type="button">
            垂直居中
          </button>
          <button className="workspace__action-button" onClick={() => duplicateLayer(selectedLayer.id)} type="button">
            复制图层
          </button>
          <button
            className="workspace__action-button workspace__action-button--danger"
            onClick={() => removeLayer(selectedLayer.id)}
            type="button"
          >
            删除图层
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="workspace">
      <aside className="workspace__column">
        <div className="workspace__panel-tabs workspace__panel-tabs--chrome">
          <button
            className={`workspace__tab-button ${leftSidebarTab === "canvas" ? "is-active" : ""}`}
            onClick={() => setLeftSidebarTab("canvas")}
            type="button"
          >
            画布
          </button>
          <button
            className={`workspace__tab-button ${leftSidebarTab === "tools" ? "is-active" : ""}`}
            onClick={() => setLeftSidebarTab("tools")}
            type="button"
          >
            工具
          </button>
          <button
            className={`workspace__tab-button ${leftSidebarTab === "layers" ? "is-active" : ""}`}
            onClick={() => setLeftSidebarTab("layers")}
            type="button"
          >
            图层
          </button>
        </div>

        <input
          accept="image/*"
          className="workspace__file-input"
          onChange={handleImportChange}
          ref={fileInputRef}
          type="file"
        />

        {leftSidebarTab === "canvas" ? (
          <>


            <section className="workspace__section">
              <h3>画布设置</h3>
              <div className="workspace__preset-grid">
                {canvasPresets.map((preset) => (
                  <button
                    key={preset.id}
                    className={`workspace__preset-button ${document.canvas.presetId === preset.id ? "is-active" : ""}`}
                    onClick={() => setCanvasPreset(preset.id)}
                    type="button"
                  >
                    <strong>{preset.label}</strong>
                    {/* <div className="workspace__meta">{preset.width} × {preset.height}</div> */}
                  </button>
                ))}
              </div>
              <div className="workspace__property-list workspace__property-list--tight">
                <label className="workspace__property">
                  <span className="workspace__property-label">画布背景</span>
                  <select
                    className="workspace__select"
                    onChange={(event) =>
                      setCanvasDisplayBackground({
                        mode: event.target.value as (typeof canvasBackgroundModes)[number]
                      })
                    }
                    value={canvasDisplayBackground.mode}
                  >
                    <option value="grid">网格线</option>
                    <option value="solid">纯色</option>
                    <option value="dots">点阵</option>
                  </select>
                </label>
                <label className="workspace__property">
                  <span className="workspace__property-label">背景色</span>
                  <input
                    className="workspace__color-input workspace__color-input--wide"
                    onChange={(event) =>
                      setCanvasDisplayBackground({
                        color: event.target.value
                      })
                    }
                    type="color"
                    value={canvasDisplayBackground.color}
                  />
                </label>
                <label className="workspace__property">
                  <span className="workspace__property-label">画布缩放</span>
                  <input
                    className="workspace__range"
                    max={3}
                    min={0.2}
                    onChange={(event) => setCanvasViewport({ zoom: Number(event.target.value) })}
                    step={0.01}
                    type="range"
                    value={viewport.zoom}
                  />
                  <div className="workspace__property-value">{Math.round(viewport.zoom * 100)}%</div>
                </label>
              </div>
            </section>
          </>
        ) : null}

        {leftSidebarTab === "tools" ? (
          <section className="workspace__section">
            <h3>工具入口</h3>
            <div className="workspace__tool-stack">
              {toolItemsAntd.filter((tool) => tool.id !== "hand").map((tool) => (
                <button
                  key={tool.id}
                  aria-label={tool.label}
                  className={`workspace__tool-button workspace__tool-button--compact ${activeTool === tool.id ? "is-active" : ""}`}
                  onClick={() => handleToolClick(tool.id)}
                  type="button"
                >
                  <span className="workspace__tool-icon" aria-hidden="true">
                    {tool.icon}
                  </span>
                  <strong>{tool.label}</strong>
                  <Tooltip>{tool.hint}</Tooltip>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {leftSidebarTab === "layers" ? (
          <section className="workspace__section workspace__section--layers">
            <div className="workspace__section-header">
              <h3>图层列表</h3>
              <div className="workspace__inline-actions">
                <button className="workspace__tool-button workspace__tool-button--small" onClick={handleImportClick} type="button">
                  导入图片
                </button>
                <button className="workspace__tool-button workspace__tool-button--small" onClick={addTextLayer} type="button">
                  添加文字
                </button>
                <button className="workspace__tool-button workspace__tool-button--small" onClick={addDecorationLayer} type="button">
                  添加装饰
                </button>
              </div>
            </div>
            <div className="workspace__layer-stack">
              {[...document.layers]
                .sort((left, right) => right.zIndex - left.zIndex)
                .map((layer) => (
                  <div
                    key={layer.id}
                    className={`workspace__layer-card ${selectedLayerIds.includes(layer.id) ? "is-active" : ""}`}
                  >
                    <button
                      className="workspace__layer-button"
                      onClick={() => {
                        selectLayer(layer.id);
                        setRightSidebarTab("layer");
                      }}
                      type="button"
                    >
                      <div className="workspace__layer-row">
                        <strong>{layer.name}</strong>
                        <span className="workspace__chip">Z{layer.zIndex}</span>
                      </div>
                      {renderLayerStatusChips(layer, selectedLayerIds.includes(layer.id))}
                    </button>
                    <div className="workspace__layer-actions">
                      <button
                        aria-label={layer.visible ? "隐藏图层" : "显示图层"}
                        className="workspace__icon-button workspace__icon-button--visibility"
                        onClick={() => toggleLayerVisibility(layer.id)}
                        type="button"
                      >
                        <span aria-hidden="true">{layer.visible ? "👁" : "🙈"}</span>
                        <Tooltip>{layer.visible ? "隐藏图层" : "显示图层"}</Tooltip>
                      </button>
                      <button
                        aria-label={layer.locked ? "解锁图层" : "锁定图层"}
                        className="workspace__icon-button workspace__icon-button--lock"
                        onClick={() => toggleLayerLock(layer.id)}
                        type="button"
                      >
                        <span aria-hidden="true">{layer.locked ? "🔓" : "🔒"}</span>
                        <Tooltip>{layer.locked ? "解锁图层" : "锁定图层"}</Tooltip>
                      </button>
                      <button
                        aria-label="上移图层"
                        className="workspace__icon-button workspace__icon-button--up"
                        onClick={() => moveLayer(layer.id, "up")}
                        type="button"
                      >
                        <span aria-hidden="true">↑</span>
                        <Tooltip>上移图层</Tooltip>
                      </button>
                      <button
                        aria-label="下移图层"
                        className="workspace__icon-button workspace__icon-button--down"
                        onClick={() => moveLayer(layer.id, "down")}
                        type="button"
                      >
                        <span aria-hidden="true">↓</span>
                        <Tooltip>下移图层</Tooltip>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : null}
      </aside>

      <main className="workspace__canvas-layout">
        <section className="workspace__stage">
          <div className="workspace__toolbar">
            <div>
              <h2>编辑画布</h2>
              <p className="workspace__meta">
                {document.workflowMeta.sceneTag} · {document.canvas.width} × {document.canvas.height}
              </p>
            </div>
            <div className="workspace__toolbar-actions">
              <button className="workspace__tool-button" disabled={!canUndo} onClick={undo} type="button">
                撤销
              </button>
              <button className="workspace__tool-button" onClick={handleClearCanvas} type="button">
                重做
              </button>
              <button className="workspace__tool-button" onClick={handleImportClick} type="button">
                导入图片
              </button>
              <button className="workspace__tool-button" onClick={addTextLayer} type="button">
                添加文字
              </button>
            </div>
          </div>

          <CanvasViewport
            activeTool={activeTool}
            cropSession={cropSession}
            document={document}
            onCropSessionChange={updateCropSession}
            onDoodleCommit={addDoodleLayer}
            onMaskAppend={appendMaskPoint}
            onMaskFinish={finishMaskStroke}
            onMaskStart={startMaskStroke}
            onSelectionChange={setSelectedLayerIds}
            onTextChange={updateTextContent}
            onTransformChange={updateLayerTransform}
            onViewportChange={setCanvasViewport}
            selectedImageLayer={selectedImageLayer}
            selectedLayerIds={selectedLayerIds}
          />
        </section>

        <section className="workspace__statusbar">
          <div className="workspace__status-group">
            <span>Layer: {selectedLayer?.name ?? "None"}</span>
            <span>Autosave: {document.draftMeta.enabled ? formatTime(lastAutoSavedAt) : "Off"}</span>
            <span>Version: {String(document.workflowMeta.version).padStart(3, "0")}</span>
          </div>
          <div className="workspace__status-group">
            <span>Safe area: {document.canvas.safeAreaInset}px</span>
            <span>Zoom: {Math.round(viewport.zoom * 100)}%</span>
            <span>Pan: {Math.round(viewport.panX)} / {Math.round(viewport.panY)}</span>
          </div>
        </section>
      </main>

      <aside className="workspace__panel">
        <div className="workspace__panel-tabs workspace__panel-tabs--chrome">
          <button
            className={`workspace__tab-button ${rightSidebarTab === "tool" ? "is-active" : ""}`}
            onClick={() => setRightSidebarTab("tool")}
            type="button"
          >
            工具属性
          </button>
          <button
            className={`workspace__tab-button ${rightSidebarTab === "layer" ? "is-active" : ""}`}
            onClick={() => setRightSidebarTab("layer")}
            type="button"
          >
            图层控制
          </button>
        </div>

        {rightSidebarTab === "tool" ? (
          <section className="workspace__section">
            <h2>工具属性</h2>
            {renderToolProperties()}
          </section>
        ) : null}

        {rightSidebarTab === "layer" ? (
          <section className="workspace__section">
            <h2>图层控制</h2>
            {renderLayerProperties()}
          </section>
        ) : null}

        {lastExportedFilename || feedbackMessage ? (
          <section className="workspace__section workspace__section--feedback">
            <div className="workspace__property-list workspace__property-list--tight">
              {lastExportedFilename ? (
                <p className="workspace__footer-note">Last export: {lastExportedFilename}</p>
              ) : null}
              {feedbackMessage ? <p className="workspace__footer-note">{feedbackMessage}</p> : null}
            </div>
          </section>
        ) : null}
      </aside>

      {isExportDialogOpen ? (
        <div
          aria-modal="true"
          className="workspace__dialog-backdrop"
          onClick={() => !isExporting && setIsExportDialogOpen(false)}
          role="dialog"
        >
          <div className="workspace__dialog" onClick={(event) => event.stopPropagation()}>
            <div className="workspace__dialog-header">
              <div>
                <h2>导出设置</h2>
              </div>
              <button
                className="workspace__icon-button workspace__icon-button--dialog-close"
                disabled={isExporting}
                onClick={() => setIsExportDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="workspace__property-list">
              <label className="workspace__property">
                <span className="workspace__property-label">导出格式</span>
                <select
                  className="workspace__select"
                  onChange={(event) =>
                    updateExportConfig({
                      format: event.target.value as EditorDocument["exportConfig"]["format"]
                    })
                  }
                  value={document.exportConfig.format}
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                </select>
              </label>

              <div className="workspace__property">
                <span className="workspace__property-label">输出品质</span>
                <div className="workspace__choice-row">
                  <button
                    className={`workspace__choice-button ${document.exportConfig.qualityPreset === "high" ? "is-active" : ""}`}
                    onClick={() => updateExportConfig({ qualityPreset: "high" })}
                    type="button"
                  >
                    高清
                  </button>
                  <button
                    className={`workspace__choice-button ${document.exportConfig.qualityPreset === "standard" ? "is-active" : ""}`}
                    onClick={() => updateExportConfig({ qualityPreset: "standard" })}
                    type="button"
                  >
                    普通
                  </button>
                </div>
              </div>

              <div className="workspace__property">
                <div className="workspace__property-label">尺寸设置</div>
                <div className="workspace__tab-row">
                  <button
                    className={`workspace__tab-button ${document.exportConfig.resizeMode === "fixed" ? "is-active" : ""}`}
                    onClick={() => updateExportConfig({ resizeMode: "fixed" })}
                    type="button"
                  >
                    指定尺寸
                  </button>
                  <button
                    className={`workspace__tab-button ${document.exportConfig.resizeMode === "scale" ? "is-active" : ""}`}
                    onClick={() => updateExportConfig({ resizeMode: "scale" })}
                    type="button"
                  >
                    等比缩放
                  </button>
                </div>

                {document.exportConfig.resizeMode === "fixed" ? (
                  <div className="workspace__dialog-section">
                    <div className="workspace__choice-row">
                      {exportSizePresetOptions.map((option) => (
                        <button
                          key={option.value}
                          className={`workspace__choice-button ${document.exportConfig.sizePreset === option.value ? "is-active" : ""}`}
                          onClick={() => handleExportSizePresetChange(option.value)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="workspace__dimension-row">
                      <label className="workspace__property workspace__property--inner">
                        <span className="workspace__property-label">宽度</span>
                        <input
                          className="workspace__text-input"
                          disabled={isFixedSizePreset}
                          min={1}
                          onChange={(event) => handleFixedWidthChange(Number(event.target.value))}
                          type="number"
                          value={document.exportConfig.width}
                        />
                      </label>
                      <button
                        aria-label={isAspectLocked ? "Unlock ratio" : "Lock ratio"}
                        className={`workspace__icon-button workspace__icon-button--lock-toggle ${isAspectLocked ? "is-active" : ""}`}
                        disabled={isFixedSizePreset}
                        onClick={handleExportLockToggle}
                        type="button"
                      >
                        {isAspectLocked ? "🔒" : "🔓"}
                      </button>
                      <label className="workspace__property workspace__property--inner">
                        <span className="workspace__property-label">高度</span>
                        <input
                          className="workspace__text-input"
                          disabled={isFixedSizePreset}
                          min={1}
                          onChange={(event) => handleFixedHeightChange(Number(event.target.value))}
                          type="number"
                          value={document.exportConfig.height}
                        />
                      </label>
                    </div>
                    <p className="workspace__footer-note">
                      {document.exportConfig.sizePreset === "group"
                        ? "锁定时保持当前画布原比例。"
                        : document.exportConfig.sizePreset === "free"
                          ? "解锁后可分别输入宽度和高度。"
                          : "1 寸和 2 寸使用固定证件尺寸。"}
                    </p>
                  </div>
                ) : (
                  <div className="workspace__dialog-section">
                    <label className="workspace__property workspace__property--inner">
                      <span className="workspace__property-label">缩放比例</span>
                      <input
                        className="workspace__range"
                        max={300}
                        min={10}
                        onChange={(event) => handleScalePercentChange(Number(event.target.value))}
                        step={1}
                        type="range"
                        value={document.exportConfig.scalePercent}
                      />
                      <div className="workspace__property-value">{document.exportConfig.scalePercent}%</div>
                    </label>
                    <div className="workspace__property-grid">
                      <label className="workspace__property workspace__property--inner">
                        <span className="workspace__property-label">宽度</span>
                        <input
                          className="workspace__text-input"
                          min={1}
                          onChange={(event) => handleScaleWidthChange(Number(event.target.value))}
                          type="number"
                          value={scaledDimensions.width}
                        />
                      </label>
                      <label className="workspace__property workspace__property--inner">
                        <span className="workspace__property-label">高度</span>
                        <input
                          className="workspace__text-input"
                          min={1}
                          onChange={(event) => handleScaleHeightChange(Number(event.target.value))}
                          type="number"
                          value={scaledDimensions.height}
                        />
                      </label>
                    </div>
                    <p className="workspace__footer-note">滑杆与像素输入会保持同步。</p>
                  </div>
                )}
              </div>
            </div>

            <div className="workspace__dialog-footer">
              <div className="workspace__footer-note">
                最终输出：
                {" "}
                {document.exportConfig.resizeMode === "scale" ? scaledDimensions.width : document.exportConfig.width}
                {" x "}
                {document.exportConfig.resizeMode === "scale" ? scaledDimensions.height : document.exportConfig.height}
              </div>
              <div className="workspace__inline-actions">
                <button
                  className="workspace__action-button"
                  disabled={isExporting}
                  onClick={() => setIsExportDialogOpen(false)}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="workspace__export-button"
                  disabled={isExporting}
                  onClick={() => void handleExport()}
                  type="button"
                >
                  {isExporting ? "导出中..." : "确认导出"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
