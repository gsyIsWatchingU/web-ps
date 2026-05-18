import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
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
  type ImageCrop,
  type TextLayer
} from "../model/document";
import { hasAiConfig } from "../runtime/aiConfig";
import { exportDocument } from "../runtime/exportDocument";
import { applyToWorkflow } from "../runtime/workflowBridge";
import { useEditorStore } from "../store/useEditorStore";
import { CanvasViewport } from "./CanvasViewport";

const EXPORT_REQUEST_EVENT = "editor:export-request";
const EXPORT_STATE_EVENT = "editor:export-state";

const toolItems = [
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

type ToolId = (typeof toolItems)[number]["id"];

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

export function EditorWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isApplyingWorkflow, setIsApplyingWorkflow] = useState(false);
  const [aiBusy, setAiBusy] = useState<"repair" | "extend" | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [lastExportedFilename, setLastExportedFilename] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
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
    commitCropSession,
    document,
    duplicateLayer,
    historyFuture,
    historyPast,
    importImage,
    markWorkflowApplied,
    moveLayer,
    recordWorkflowExport,
    redo,
    removeLayer,
    resetImageAdjustments,
    resetImageCrop,
    selectedLayerIds,
    selectLayer,
    setActiveTool,
    setCanvasPreset,
    setCanvasViewport,
    setImageCropAspect,
    setSelectedLayerIds,
    startCropSession,
    startMaskStroke,
    appendMaskPoint,
    finishMaskStroke,
    toggleLayerLock,
    toggleLayerVisibility,
    toggleMaskPreview,
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
  const activeToolItem = toolItems.find((tool) => tool.id === activeTool);
  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;
  const viewport = document.canvas.viewport;
  const aiConfigured = hasAiConfig();
  const activeCropDraft =
    cropSession && selectedImageLayer && cropSession.layerId === selectedImageLayer.id
      ? cropSession.draft
      : selectedImageLayer?.crop ?? null;

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
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const handleExportRequest = () => {
      void handleExport();
    };

    window.addEventListener(EXPORT_REQUEST_EVENT, handleExportRequest);
    return () => window.removeEventListener(EXPORT_REQUEST_EVENT, handleExportRequest);
  });

  const handleApplyWorkflow = async () => {
    setIsApplyingWorkflow(true);
    setFeedbackMessage(null);

    try {
      const result = await applyToWorkflow(document);
      setFeedbackMessage(result.message);

      if (result.success) {
        markWorkflowApplied();
      }
    } finally {
      setIsApplyingWorkflow(false);
    }
  };

  const handleAiRepair = async () => {
    if (!selectedImageLayer) {
      setFeedbackMessage("请先选中图片图层，再执行局部修复。");
      return;
    }

    setAiBusy("repair");
    setFeedbackMessage(null);

    try {
      const result = await applyAiRepair(selectedImageLayer.id);
      setFeedbackMessage(result.success ? "AI 局部修复已完成。" : result.errorMessage);
    } finally {
      setAiBusy(null);
    }
  };

  const handleAiExtend = async (presetId: CanvasPresetId) => {
    if (!selectedImageLayer) {
      setFeedbackMessage("请先选中图片图层，再执行 AI 扩图。");
      return;
    }

    setAiBusy("extend");
    setFeedbackMessage(null);

    try {
      const result = await applyAiExtend(selectedImageLayer.id, presetId);
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
    if (toolId === "repair") {
      void handleAiRepair();
      return;
    }

    setActiveTool(toolId);
  };

  const renderToolProperties = () => {
    if (selectedImageLayer) {
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
            <p className="workspace__footer-note">
              进入裁剪模式后，可直接在画布中拖动四边或四角，快速调整图片构图。
            </p>
            <div className="workspace__inline-actions">
              {activeTool === "crop" ? (
                <>
                  <button className="workspace__action-button" onClick={commitCropSession} type="button">
                    应用裁剪
                  </button>
                  <button className="workspace__action-button" onClick={cancelCropSession} type="button">
                    取消裁剪
                  </button>
                  <button className="workspace__action-button" onClick={handleCropReset} type="button">
                    重置裁剪
                  </button>
                </>
              ) : (
                <button className="workspace__action-button" onClick={() => setActiveTool("crop")} type="button">
                  进入裁剪模式
                </button>
              )}
            </div>
          </div>

          <div className="workspace__property">
            <div className="workspace__property-label">滤镜预设</div>
            <div className="workspace__tool-stack">
              {imageFilterPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={`workspace__tool-button workspace__tool-button--stack ${
                    selectedImageLayer.presetFilterId === preset.id ? "is-active" : ""
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
                  className={`workspace__tool-button workspace__tool-button--stack ${
                    selectedTextLayer.textTemplateId === template.id ? "is-active" : ""
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
        <section className="workspace__section">
          <h2>画布概览</h2>
          <div className="workspace__metrics">
            <div className="workspace__metric">
              <span>当前比例</span>
              <strong>{document.canvas.presetId}</strong>
            </div>
            <div className="workspace__metric">
              <span>投放场景</span>
              <strong>{document.workflowMeta.sceneTag}</strong>
            </div>
          </div>
          <p className="workspace__hint">左侧选择工具和图层，中间直接编辑画布，右侧完成属性调整与工作流回填。</p>
        </section>

        <section className="workspace__section">
          <h3>画布设置</h3>
          <div className="workspace__preset-grid">
            {canvasPresets.map((preset) => (
              <button
                key={preset.id}
                className={`workspace__preset-button ${
                  document.canvas.presetId === preset.id ? "is-active" : ""
                }`}
                onClick={() => setCanvasPreset(preset.id)}
                type="button"
              >
                <strong>{preset.label}</strong>
                <div className="workspace__meta">{preset.width} × {preset.height}</div>
                <div className="workspace__meta">{preset.scene}</div>
              </button>
            ))}
          </div>
          <div className="workspace__property-list workspace__property-list--tight">
            <label className="workspace__property">
              <span className="workspace__property-label">画布缩放</span>
              <input
                className="workspace__range"
                max={2}
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

        <section className="workspace__section">
          <h3>工具入口</h3>
          <div className="workspace__tool-stack">
            {toolItems.map((tool) => (
              <button
                key={tool.id}
                aria-label={tool.label}
                className={`workspace__tool-button workspace__tool-button--compact ${
                  activeTool === tool.id ? "is-active" : ""
                }`}
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

        <section className="workspace__section">
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
          <input
            accept="image/*"
            className="workspace__file-input"
            onChange={handleImportChange}
            ref={fileInputRef}
            type="file"
          />
          <div className="workspace__layer-stack">
            {[...document.layers]
              .sort((left, right) => right.zIndex - left.zIndex)
              .map((layer) => (
                <div
                  key={layer.id}
                  className={`workspace__layer-card ${
                    selectedLayerIds.includes(layer.id) ? "is-active" : ""
                  }`}
                >
                  <button className="workspace__layer-button" onClick={() => selectLayer(layer.id)} type="button">
                    <div className="workspace__layer-row">
                      <strong>{layer.name}</strong>
                      <span className="workspace__chip">Z{layer.zIndex}</span>
                    </div>
                    <div className="workspace__layer-meta">
                      <span className="workspace__chip">{layerTypeLabels[layer.type]}</span>
                      <span className="workspace__chip">{layer.visible ? "显示" : "隐藏"}</span>
                      <span className="workspace__chip">{layer.locked ? "已锁定" : "可编辑"}</span>
                    </div>
                  </button>
                  <div className="workspace__layer-actions">
                    <button
                      aria-label={layer.visible ? "隐藏图层" : "显示图层"}
                      className="workspace__icon-button"
                      onClick={() => toggleLayerVisibility(layer.id)}
                      type="button"
                    >
                      <span aria-hidden="true">{layer.visible ? "👁" : "🙈"}</span>
                      <Tooltip>{layer.visible ? "隐藏图层" : "显示图层"}</Tooltip>
                    </button>
                    <button
                      aria-label={layer.locked ? "解锁图层" : "锁定图层"}
                      className="workspace__icon-button"
                      onClick={() => toggleLayerLock(layer.id)}
                      type="button"
                    >
                      <span aria-hidden="true">{layer.locked ? "🔓" : "🔒"}</span>
                      <Tooltip>{layer.locked ? "解锁图层" : "锁定图层"}</Tooltip>
                    </button>
                    <button
                      aria-label="上移图层"
                      className="workspace__icon-button"
                      onClick={() => moveLayer(layer.id, "up")}
                      type="button"
                    >
                      <span aria-hidden="true">↑</span>
                      <Tooltip>上移图层</Tooltip>
                    </button>
                    <button
                      aria-label="下移图层"
                      className="workspace__icon-button"
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
              <button className="workspace__tool-button" disabled={!canRedo} onClick={redo} type="button">
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
            onTransformChange={updateLayerTransform}
            onViewportChange={setCanvasViewport}
            selectedImageLayer={selectedImageLayer}
            selectedLayerIds={selectedLayerIds}
          />
        </section>

        <section className="workspace__statusbar">
          <div className="workspace__status-group">
            <span>当前图层：{selectedLayer?.name ?? "未选中"}</span>
            <span>自动保存：{document.draftMeta.enabled ? formatTime(lastAutoSavedAt) : "未开启"}</span>
            <span>版本：{String(document.workflowMeta.version).padStart(3, "0")}</span>
          </div>
          <div className="workspace__status-group">
            <span>安全区：{document.canvas.safeAreaInset}px</span>
            <span>Zoom：{Math.round(viewport.zoom * 100)}%</span>
            <span>Pan：{Math.round(viewport.panX)} / {Math.round(viewport.panY)}</span>
          </div>
        </section>
      </main>

      <aside className="workspace__panel">
        <section className="workspace__section">
          <h2>导出设置与回填</h2>
          <div className="workspace__property-list">
            <div className="workspace__property">
              <div className="workspace__property-label">投放场景</div>
              <div className="workspace__property-value">{document.workflowMeta.sceneTag}</div>
              <p className="workspace__footer-note">导出会基于当前画布内容、比例和版本信息生成最终素材。</p>
            </div>
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
            <label className="workspace__property">
              <span className="workspace__property-label">导出倍率</span>
              <input
                className="workspace__range"
                max={3}
                min={1}
                onChange={(event) => updateExportConfig({ scale: Number(event.target.value) })}
                step={0.1}
                type="range"
                value={document.exportConfig.scale}
              />
              <div className="workspace__property-value">{document.exportConfig.scale.toFixed(1)}x</div>
            </label>
            <div className="workspace__inline-actions">
              <button
                className="workspace__action-button"
                disabled={isApplyingWorkflow}
                onClick={() => void handleApplyWorkflow()}
                type="button"
              >
                {isApplyingWorkflow ? "回填中..." : "回填到工作流"}
              </button>
            </div>
            {lastExportedFilename ? <p className="workspace__footer-note">最近导出：{lastExportedFilename}</p> : null}
            {feedbackMessage ? <p className="workspace__footer-note">{feedbackMessage}</p> : null}
          </div>
        </section>

        <section className="workspace__section">
          <h2>工具属性</h2>
          {renderToolProperties()}
        </section>

        <section className="workspace__section">
          <h2>图层属性</h2>
          {renderLayerProperties()}
        </section>
      </aside>
    </div>
  );
}
