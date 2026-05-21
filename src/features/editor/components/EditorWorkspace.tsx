import { startTransition, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode } from "react";
import {
  canvasBackgroundModes,
  canvasPresets,
  createDefaultDoodleStyle,
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
import { renderPresetPreviewDataUrl } from "../runtime/lutEngine";
import { useEditorStore } from "../store/useEditorStore";
import { CanvasViewport } from "./CanvasViewport";
import { GlbUploadPreviewDialog } from "./GlbUploadPreviewDialog";
import { ModelPreviewDialog } from "./ModelPreviewDialog";
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
  { id: "brush", label: "圈选调整", hint: "圈出需要 AI 调整的局部区域", icon: "◌" },
  { id: "eraser", label: "擦除圈选", hint: "擦掉多选或误选的调整区域", icon: "⌫" },
  { id: "repair", label: "执行重绘", hint: "对当前圈选区域执行 AI 局部重绘", icon: "✦" },
  { id: "filter", label: "滤镜", hint: "套用预设滤镜并微调画面质感", icon: "◐" },
  { id: "shape", label: "装饰", hint: "添加徽章、贴片和强调色块", icon: "◆" }
] as const;

const cropAspectOptions: Array<{ label: string; value: number | null }> = [
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "9:16", value: 9 / 16 },
  { label: "原始", value: null },

];

// Legacy options kept only to avoid touching surrounding encoded text.
const decorationShapeOptions: Array<{
  value: string;
  label: string;
}> = [
    { value: "highlight", label: "高亮条" },
    { value: "badge", label: "徽章" },
    { value: "ribbon", label: "缎带" }
  ];
const decorationKindSelectOptions: Array<{
  value: DecorationLayer["decorationKind"];
  label: string;
}> = [
    { value: "shape", label: "形状" },
    { value: "sticker", label: "贴纸" }
  ];

const decorationShapeSelectOptions: Array<{
  value: DecorationLayer["shape"];
  label: string;
}> = [
    { value: "heart", label: "心形" },
    { value: "circle", label: "圆形" },
    { value: "rectangle", label: "长方形" }
  ];

const decorationStickerSelectOptions: Array<{
  value: DecorationLayer["sticker"];
  label: string;
}> = [
    { value: "star", label: "星星" },
    { value: "ribbon", label: "蝴蝶结" },
    { value: "bear", label: "小熊" },
    { value: "strawberry", label: "草莓" },
    { value: "sparkle", label: "闪光" }
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

function isDashScopeAccountIssueMessage(message: string | null) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();

  return [
    "access denied",
    "good standing",
    "overdue payment",
    "insufficient balance",
    "quota",
    "forbidden",
    "账号状态异常",
    "余额不足",
    "无权限"
  ].some((keyword) => normalized.includes(keyword));
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
        {layer.visible ? "显示" : "隐藏"}
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

const IMAGE_REQUIRED_TOOLS: ToolId[] = ["crop", "filter", "repair", "ai3d"];
const FILTER_PREVIEW_SOURCE = "/help/filter-preview-sample.svg";

function buildPersistedDraft(document: EditorDocument, savedAt: string): EditorDocument {
  return {
    ...document,
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
    id: "repair",
    label: "局部重绘",
    hint: "框选需要AI重绘的局部区域",
    icon: (
      <IconBase>
        <path d="M6 17 17 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m14 5 1.5-1.5a2.12 2.12 0 1 1 3 3L17 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m5 14 5 5-6 1 1-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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
    id: "ai3d",
    label: "立体创作",
    hint: "基于图片生成3D模型，仅支持URL图片",
    icon: (
      <IconBase>
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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
  const [aiBusy, setAiBusy] = useState<"repair" | "ai3d" | null>(null);
  const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>("tools");
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>("tool");
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [lastExportedFilename, setLastExportedFilename] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isModelPreviewOpen, setIsModelPreviewOpen] = useState(false);
  const [isGlbPreviewOpen, setIsGlbPreviewOpen] = useState(false);
  const [previewModelUrl, setPreviewModelUrl] = useState<string>("");
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [doodleStyle, setDoodleStyle] = useState(createDefaultDoodleStyle);
  const [filterPreviewSources, setFilterPreviewSources] = useState<
    Record<(typeof imageFilterPresets)[number]["id"], string>
  >({} as Record<(typeof imageFilterPresets)[number]["id"], string>);
  const {
    activeTool,
    cropSession,
    repairSession,
    addDecorationLayer,
    addDoodleLayer,
    addTextLayer,
    appendRepairStroke,
    applyAiRepair,
    applyAi3d,
    applyEnhanceProfile,
    applyImagePreset,
    applyTextTemplate,
    centerLayer,
    clearCanvas,
    commitCropSession,
    document,
    duplicateLayer,
    historyPast,
    historyFuture,
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
    setRepairBrushSize,
    setImageCropAspect,
    setSelectedLayerIds,
    startRepairSession,
    startCropSession,
    toggleLayerLock,
    toggleLayerVisibility,
    clearRepairSession,
    cancelCropSession,
    undo,
    updateAiExpandPrompt,
    updateAiPrompt,
    updateRepairPrompt,
    updateCropSession,
    updateDecorationKind,
    updateDecorationFill,
    updateDecorationShape,
    updateDecorationSize,
    updateDecorationSticker,
    updateDoodleStyle,
    updateExportConfig,
    updateImageFilters,
    updateLayerName,
    updateLayerOpacity,
    updateLayerTransform,
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
  const canRedo = historyFuture.length > 0;
  const viewport = document.canvas.viewport;
  const canvasDisplayBackground = document.canvas.displayBackground;
  const aiConfigured = hasAiConfig();
  const activeCropDraft =
    cropSession && selectedImageLayer && cropSession.layerId === selectedImageLayer.id
      ? cropSession.draft
      : selectedImageLayer?.crop ?? null;
  const activeRepairSession =
    repairSession && selectedImageLayer && repairSession.layerId === selectedImageLayer.id
      ? repairSession
      : null;
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
  const hasRepairMask = Boolean(activeRepairSession?.strokes.some((stroke) => stroke.points.length > 1));

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const entries = await Promise.all(
        imageFilterPresets.map(async (preset) => [
          preset.id,
          await renderPresetPreviewDataUrl(FILTER_PREVIEW_SOURCE, preset.id)
        ] as const)
      );

      if (cancelled) {
        return;
      }

      startTransition(() => {
        setFilterPreviewSources(
          Object.fromEntries(entries) as Record<(typeof imageFilterPresets)[number]["id"], string>
        );
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
    if (activeTool === "repair" && selectedImageLayer) {
      if (!repairSession || repairSession.layerId !== selectedImageLayer.id) {
        startRepairSession(selectedImageLayer.id);
      }
    }
  }, [activeTool, repairSession, selectedImageLayer, startRepairSession]);

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

  const handleAi3d = async () => {
    if (!requireSelectedImageLayer("ai3d")) {
      return;
    }

    const imageLayer = selectedImageLayer;

    if (!imageLayer) {
      return;
    }

    const targetUrl = imageLayer.source;

    const isValidImageSource =
      targetUrl.startsWith("http://") ||
      targetUrl.startsWith("https://") ||
      targetUrl.startsWith("data:image/");

    if (!isValidImageSource) {
      message.warning("请提供有效的图片。支持 http/https URL 或本地上传的图片。");
      return;
    }

    setFeedbackMessage(null);

    try {
      const result = await applyAi3d(imageLayer.id, targetUrl);
      const task = imageLayer.aiMeta.model3dTask;
      if (result.success && task.status === "succeeded" && task.downloadUrl) {
        setFeedbackMessage(`立体创作成功！文件已准备就绪，可下载 ${task.fileName}。`);
      } else {
        setFeedbackMessage(result.errorMessage ?? "立体创作失败。");
      }
    } finally {
    }
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

      if (result.success) {
        setFeedbackMessage("局部重绘完成，已替换选中的图片。");
        return;
      }

      setFeedbackMessage(result.errorMessage ?? "局部重绘失败。");
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

    setFeedbackMessage(null);
    setActiveTool(toolId);
  };

  const handleDoodleCommit = (points: Parameters<typeof addDoodleLayer>[0]) => {
    addDoodleLayer(points, doodleStyle);
  };

  const handleRepairStrokeCommit = (points: Parameters<typeof appendRepairStroke>[0]) => {
    appendRepairStroke(points);
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
              裁剪、滤镜和立体创作都需要先选中一个图片图层，右侧才能继续编辑。
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

    if (activeTool === "doodle") {
      return (
        <div className="workspace__property-list">
          <label className="workspace__property">
            <span className="workspace__property-label">画笔颜色</span>
            <input
              className="workspace__color-input workspace__color-input--wide"
              onChange={(event) =>
                setDoodleStyle((current) => ({
                  ...current,
                  stroke: event.target.value
                }))
              }
              type="color"
              value={doodleStyle.stroke}
            />
          </label>
          <label className="workspace__property">
            <span className="workspace__property-label">画笔粗细</span>
            <input
              className="workspace__range"
              max={64}
              min={2}
              onChange={(event) =>
                setDoodleStyle((current) => ({
                  ...current,
                  strokeWidth: Number(event.target.value)
                }))
              }
              step={1}
              type="range"
              value={doodleStyle.strokeWidth}
            />
            <div className="workspace__property-value">{doodleStyle.strokeWidth}px</div>
          </label>
        </div>
      );
    }

    if (selectedImageLayer) {
      const filterAdjustmentControls = (
        [
          ["intensity", "滤镜强度", 0, 100, 1],
          ["brightness", "亮度微调", -0.4, 0.4, 0.01],
          ["contrast", "对比微调", -0.4, 0.4, 0.01],
          ["saturation", "饱和微调", -0.4, 0.4, 0.01]
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
          <div className="workspace__property-value">
            {key === "intensity"
              ? `${Math.round(selectedImageLayer.filters[key])}%`
              : selectedImageLayer.filters[key].toFixed(2)}
          </div>
        </label>
      ));

      const advancedAdjustmentControls = (
        [
          ["vibrance", "自然饱和", -0.4, 0.4, 0.01],
          ["temperature", "冷暖平衡", -0.4, 0.4, 0.01],
          ["hue", "色相偏移", -0.4, 0.4, 0.01],
          ["sharpen", "清晰增强", 0, 0.4, 0.01],
          ["blur", "柔化", 0, 0.2, 0.01]
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
      ));

      const lastAiError = selectedImageLayer.aiMeta.lastAiError;

      if (activeTool === "repair") {
        const repairTask = selectedImageLayer.aiMeta.repairTask;

        return (
          <div className="workspace__property-list">
            {!aiConfigured ? (
              <p className="workspace__warning">
                AI 配置未完成。请先设置 `VITE_AI_BASE_URL`、`VITE_AI_API_KEY` 和支持调整的模型。
              </p>
            ) : null}
            <label className="workspace__property">
              <span className="workspace__property-label">调整提示词</span>
              <textarea
                className="workspace__text-area"
                onChange={(event) => updateRepairPrompt(selectedImageLayer.id, event.target.value)}
                placeholder="描述您想要的局部修改，例如：移除水印、替换logo、调整破损边缘。"
                rows={4}
                value={selectedImageLayer.aiMeta.repairPrompt}
              />
            </label>
            <div className="workspace__inline-actions">
              <button
                className="workspace__action-button"
                disabled={!activeRepairSession || activeRepairSession.isSubmitting || !hasRepairMask}
                onClick={() => clearRepairSession()}
                type="button"
              >
                清除选区
              </button>
              <button
                className="workspace__action-button"
                disabled={
                  aiBusy !== null ||
                  !aiConfigured ||
                  !activeRepairSession ||
                  activeRepairSession.isSubmitting ||
                  !hasRepairMask ||
                  !selectedImageLayer.aiMeta.repairPrompt.trim()
                }
                onClick={() => void handleAiRepair()}
                type="button"
              >
                {aiBusy === "repair" || activeRepairSession?.isSubmitting ? "重绘中..." : "执行重绘"}
              </button>
            </div>
            <p className="workspace__footer-note">
              在画布上框选需要修改的区域，然后在提示词中描述编辑内容。图片其余部分将作为模型的上下文参考。
            </p>
            {repairTask.status !== "idle" ? (
              <p className="workspace__footer-note">
                重绘状态: {repairTask.status}
                {repairTask.taskId ? ` (${repairTask.taskId})` : ""}
              </p>
            ) : null}
            {repairTask.errorMessage ? <p className="workspace__warning">{repairTask.errorMessage}</p> : null}
            {lastAiError && !repairTask.errorMessage ? <p className="workspace__warning">{lastAiError}</p> : null}
          </div>
        );
      }

      if (activeTool === "crop") {
        return (
          <div className="workspace__property-list">
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
                  应用裁剪
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (activeTool === "filter") {
        return (
          <div className="workspace__property-list">
            <div className="workspace__property">
              <div className="workspace__property-label">滤镜预设</div>
              <div className="workspace__filter-preview-grid">
                {imageFilterPresets.map((preset) => (
                  <button
                    key={preset.id}
                    aria-pressed={selectedImageLayer.presetFilterId === preset.id}
                    className={`workspace__filter-preview-card ${selectedImageLayer.presetFilterId === preset.id ? "is-active" : ""
                      }`}
                    onClick={() => applyImagePreset(selectedImageLayer.id, preset.id)}
                    type="button"
                  >
                    <div className="workspace__filter-preview-image-shell">
                      {filterPreviewSources[preset.id] ? (
                        <img
                          alt={preset.label}
                          className="workspace__filter-preview-image"
                          src={filterPreviewSources[preset.id]}
                        />
                      ) : (
                        <div className="workspace__filter-preview-placeholder">预览生成中</div>
                      )}
                    </div>
                    <strong className="workspace__filter-preview-title">{preset.label}</strong>
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

            {filterAdjustmentControls}

            <details className="workspace__property">
              <summary className="workspace__property-label">高级微调</summary>
              <div className="workspace__property-list workspace__property-list--nested">
                {advancedAdjustmentControls}
              </div>
            </details>
          </div>
        );
      }

      if (activeTool === "ai3d") {
        const isUrlImage = selectedImageLayer.source.startsWith("http://") || selectedImageLayer.source.startsWith("https://");
        const isBase64Image = selectedImageLayer.source.startsWith("data:image/");
        const canGenerate = isUrlImage || isBase64Image;
        const task = selectedImageLayer.aiMeta.model3dTask;
        return (
          <div className="workspace__property-list">
            <div className="workspace__property">
              <div className="workspace__property-label">立体创作</div>
              <p className="workspace__footer-note">
                基于图片生成 3D 模型，支持本地上传图片和网络图片 URL。
              </p>
              {!aiConfigured ? (
                <p className="workspace__warning">
                  AI 配置未完成，请先在环境变量中配置火山引擎 API。
                </p>
              ) : null}
              <label className="workspace__property workspace__property--inner">
                <span className="workspace__property-label">生成提示词</span>
                <textarea
                  className="workspace__text-area"
                  onChange={(event) => updateAiPrompt(selectedImageLayer.id, event.target.value)}
                  rows={3}
                  value={selectedImageLayer.aiMeta.prompt}
                  placeholder="描述图片内容，帮助 AI 生成更准确的 3D 模型..."
                />
              </label>
              <div className="workspace__inline-actions">
                <button
                  className="workspace__action-button"
                  disabled={(task.status === "pending" || task.status === "running") || !aiConfigured || !canGenerate}
                  onClick={() => void handleAi3d()}
                  type="button"
                >
                  {(task.status === "pending" || task.status === "running") ? "创作中..." : "开始立体创作"}
                </button>
              </div>
              {task.status === "pending" ? (
                <p className="workspace__footer-note">正在创建任务...</p>
              ) : task.status === "running" ? (
                <p className="workspace__footer-note">任务处理中，请稍候...</p>
              ) : task.status === "succeeded" && task.downloadUrl ? (
                <div className="workspace__inline-actions">
                  <a
                    className="workspace__action-button"
                    download={task.fileName}
                    href={task.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    下载模型
                  </a>
                  <button
                    className="workspace__action-button"
                    onClick={() => {
                      setPreviewModelUrl(task.downloadUrl!);
                      setPreviewFileName(task.fileName || "model.glb");
                      setIsModelPreviewOpen(true);
                    }}
                    type="button"
                  >
                    在线预览
                  </button>
                </div>
              ) : null}
              {lastAiError ? (
                <p className="workspace__warning">{lastAiError}</p>
              ) : null}
              {task.taskId ? (
                <p className="workspace__footer-note">任务 ID: {task.taskId}</p>
              ) : null}
            </div>
          </div>
        );
      }

      if (activeToolItem?.id === "doodle") {
        return (
          <div className="workspace__property-list">
            <label className="workspace__property">
              <span className="workspace__property-label">画笔颜色</span>
              <input
                className="workspace__color-input workspace__color-input--wide"
                onChange={(event) =>
                  setDoodleStyle((current) => ({
                    ...current,
                    stroke: event.target.value
                  }))
                }
                type="color"
                value={doodleStyle.stroke}
              />
            </label>
            <label className="workspace__property">
              <span className="workspace__property-label">画笔粗细</span>
              <input
                className="workspace__range"
                max={64}
                min={2}
                onChange={(event) =>
                  setDoodleStyle((current) => ({
                    ...current,
                    strokeWidth: Number(event.target.value)
                  }))
                }
                step={1}
                type="range"
                value={doodleStyle.strokeWidth}
              />
              <div className="workspace__property-value">{doodleStyle.strokeWidth}px</div>
            </label>
          </div>
        );
      }

      if (activeTool === "select" || activeTool === "text" || activeTool === "shape") {
        return (
          <div className="workspace__property-list">
            <div className="workspace__property workspace__property--highlight">
              <div className="workspace__property-label">当前工具暂无额外属性</div>
              <p className="workspace__footer-note">
                继续在画布上操作，或切换到右侧“图层属性”查看当前选中图层的详细设置。
              </p>
            </div>
          </div>
        );
      }

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
            <div className="workspace__filter-preview-grid">
              {imageFilterPresets.map((preset) => (
                <button
                  key={preset.id}
                  aria-pressed={selectedImageLayer.presetFilterId === preset.id}
                  className={`workspace__filter-preview-card ${selectedImageLayer.presetFilterId === preset.id ? "is-active" : ""
                    }`}
                  onClick={() => applyImagePreset(selectedImageLayer.id, preset.id)}
                  type="button"
                >
                  <div className="workspace__filter-preview-image-shell">
                    {filterPreviewSources[preset.id] ? (
                      <img
                        alt={preset.label}
                        className="workspace__filter-preview-image"
                        src={filterPreviewSources[preset.id]}
                      />
                    ) : (
                      <div className="workspace__filter-preview-placeholder">é¢„è§ˆç”Ÿæˆä¸­</div>
                    )}
                  </div>
                  {selectedImageLayer.presetFilterId === preset.id ? (
                    <span className="workspace__filter-preview-badge">已选</span>
                  ) : null}
                  <strong className="workspace__filter-preview-title">{preset.label}</strong>
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
              ["intensity", "滤镜强度", 0, 100, 1],
              ["brightness", "亮度微调", -0.4, 0.4, 0.01],
              ["contrast", "对比微调", -0.4, 0.4, 0.01],
              ["saturation", "饱和微调", -0.4, 0.4, 0.01]
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
              <div className="workspace__property-value">
                {key === "intensity"
                  ? `${Math.round(selectedImageLayer.filters[key])}%`
                  : selectedImageLayer.filters[key].toFixed(2)}
              </div>
            </label>
          ))}

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
            <span className="workspace__property-label">装饰分类</span>
            <select
              className="workspace__select"
              onChange={(event) =>
                updateDecorationKind(
                  selectedDecorationLayer.id,
                  event.target.value as DecorationLayer["decorationKind"]
                )
              }
              value={selectedDecorationLayer.decorationKind}
            >
              {decorationKindSelectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {selectedDecorationLayer.decorationKind === "shape" ? (
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
                {decorationShapeSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="workspace__property">
              <span className="workspace__property-label">贴纸样式</span>
              <select
                className="workspace__select"
                onChange={(event) =>
                  updateDecorationSticker(
                    selectedDecorationLayer.id,
                    event.target.value as DecorationLayer["sticker"]
                  )
                }
                value={selectedDecorationLayer.sticker}
              >
                {decorationStickerSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="workspace__property-grid">
            <label className="workspace__property">
              <span className="workspace__property-label">宽度</span>
              <input
                className="workspace__range"
                max={800}
                min={24}
                onChange={(event) =>
                  updateDecorationSize(selectedDecorationLayer.id, {
                    width: Number(event.target.value)
                  })
                }
                step={1}
                type="range"
                value={selectedDecorationLayer.width}
              />
              <div className="workspace__property-value">{selectedDecorationLayer.width}px</div>
            </label>
            <label className="workspace__property">
              <span className="workspace__property-label">高度</span>
              <input
                className="workspace__range"
                max={800}
                min={24}
                onChange={(event) =>
                  updateDecorationSize(selectedDecorationLayer.id, {
                    height: Number(event.target.value)
                  })
                }
                step={1}
                type="range"
                value={selectedDecorationLayer.height}
              />
              <div className="workspace__property-value">{selectedDecorationLayer.height}px</div>
            </label>
          </div>
          {selectedDecorationLayer.decorationKind === "shape" ? (
            <label className="workspace__property">
              <span className="workspace__property-label">填充颜色</span>
              <input
                className="workspace__color-input workspace__color-input--wide"
                onChange={(event) => updateDecorationFill(selectedDecorationLayer.id, event.target.value)}
                type="color"
                value={selectedDecorationLayer.fill}
              />
            </label>
          ) : null}
        </div>
      );
    }

    const legacyDecorationLayer = selectedDecorationLayer as DecorationLayer | null;

    if (legacyDecorationLayer && !legacyDecorationLayer.decorationKind) {
      return (
        <div className="workspace__property-list">
          <label className="workspace__property">
            <span className="workspace__property-label">装饰形状</span>
            <select
              className="workspace__select"
              onChange={(event) =>
                updateDecorationShape(
                  legacyDecorationLayer.id,
                  event.target.value as DecorationLayer["shape"]
                )
              }
              value={legacyDecorationLayer.shape}
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
              onChange={(event) => updateDecorationFill(legacyDecorationLayer.id, event.target.value)}
              type="color"
              value={legacyDecorationLayer.fill}
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
          <span className="workspace__property-label">图层名称</span>
          <input
            className="workspace__text-input"
            onChange={(event) => updateLayerName(selectedLayer.id, event.target.value)}
            type="text"
            value={selectedLayer.name}
          />
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

            <button className="workspace__action-button" onClick={() => centerLayer(selectedLayer.id, "horizontal")} type="button">
              水平居中
            </button>
            <button className="workspace__action-button" onClick={() => centerLayer(selectedLayer.id, "vertical")} type="button">
              垂直居中
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

        <div className="workspace__column-content">
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
                {toolItemsAntd
                  .filter((tool) => tool.id !== "hand" && tool.id !== "shape" && tool.id !== "text")
                  .sort((left, right) => {
                    const order: Record<string, number> = {
                      ai3d: 1,
                      repair: 2
                    };
                    return (order[left.id] ?? 0) - (order[right.id] ?? 0);
                  })
                  .map((tool) => (
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
              <h3>图层列表</h3>
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
                          <div>
                            <strong>{layer.name}</strong>
                            {renderLayerStatusChips(layer)}
                          </div>
                        </div>
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
        </div>
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
              <button className="workspace__tool-button workspace__tool-button--overlay-label" data-label="撤销" disabled={!canUndo} onClick={undo} type="button">
                撤销
              </button>
              <button className="workspace__tool-button workspace__tool-button--overlay-label" data-label="重做" disabled={!canRedo} onClick={redo} type="button">
                重做
              </button>
              <button className="workspace__tool-button workspace__tool-button--overlay-label" data-label="清空" onClick={handleClearCanvas} type="button">
                清空
              </button>
              <button className="workspace__tool-button" onClick={handleImportClick} type="button">
                导入图片
              </button>
              <button className="workspace__tool-button" onClick={addTextLayer} type="button">
                添加花字
              </button>
              <button className="workspace__tool-button" onClick={addDecorationLayer} type="button">
                添加装饰
              </button>
              <button className="workspace__tool-button" onClick={() => setIsGlbPreviewOpen(true)} type="button">
                预览文件
              </button>
            </div>
          </div>

          <CanvasViewport
            activeTool={activeTool}
            cropSession={cropSession}
            document={document}
            onCropSessionChange={updateCropSession}
            doodleStyle={doodleStyle}
            onDoodleCommit={handleDoodleCommit}
            onRepairStrokeCommit={handleRepairStrokeCommit}
            onSelectionChange={setSelectedLayerIds}
            onTextChange={updateTextContent}
            onTransformChange={updateLayerTransform}
            onViewportChange={setCanvasViewport}
            repairSession={repairSession}
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
            <span>安全区: {document.canvas.safeAreaInset}px</span>
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

        <div className="workspace__panel-content">
          {rightSidebarTab === "tool" ? (
            <section className="workspace__section">
              <h2>工具属性</h2>
              <br />
              {renderToolProperties()}
            </section>
          ) : null}

          {rightSidebarTab === "layer" ? (
            <section className="workspace__section">
              <h2>图层控制</h2>
              <br />
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
        </div>
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

      <ModelPreviewDialog
        modelUrl={previewModelUrl}
        fileName={previewFileName}
        isOpen={isModelPreviewOpen}
        onClose={() => setIsModelPreviewOpen(false)}
      />

      <GlbUploadPreviewDialog
        isOpen={isGlbPreviewOpen}
        onClose={() => setIsGlbPreviewOpen(false)}
      />
    </div>
  );
}
