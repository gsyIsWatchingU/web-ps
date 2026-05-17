import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  canvasPresets,
  enhanceProfiles,
  imageFilterPresets,
  layerTypeLabels,
  textTemplatePresets,
  type DecorationLayer,
  type EditorLayer,
  type TextLayer
} from "../model/document";
import { exportDocument } from "../runtime/exportDocument";
import { useEditorStore } from "../store/useEditorStore";
import { CanvasViewport } from "./CanvasViewport";

const toolItems = [
  { id: "select", label: "选择", hint: "选中并调整图层" },
  { id: "hand", label: "平移", hint: "拖动画布视口" },
  { id: "crop", label: "裁剪", hint: "适配投放比例" },
  { id: "text", label: "花字", hint: "添加卖点文案" },
  { id: "filter", label: "滤镜", hint: "统一商品质感" },
  { id: "shape", label: "装饰", hint: "补卖点标签" }
] as const;

const cropAspectOptions: Array<{
  label: string;
  value: number | null;
}> = [
  { label: "自由", value: null },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "9:16", value: 9 / 16 }
];

function getSelectedImageLayer(layer: EditorLayer | undefined) {
  return layer?.type === "image" ? layer : null;
}

function getSelectedTextLayer(layer: EditorLayer | undefined) {
  return layer?.type === "text" ? layer : null;
}

function getSelectedDecorationLayer(layer: EditorLayer | undefined) {
  return layer?.type === "decoration" ? layer : null;
}

const decorationShapeOptions: Array<{
  value: DecorationLayer["shape"];
  label: string;
}> = [
  { value: "highlight", label: "高亮条" },
  { value: "badge", label: "角标" },
  { value: "ribbon", label: "飘带" }
];

const fontWeightOptions: Array<{
  value: TextLayer["style"]["fontWeight"];
  label: string;
}> = [
  { value: 500, label: "中黑" },
  { value: 700, label: "加粗" },
  { value: 800, label: "特粗" }
];

export function EditorWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [lastExportedFilename, setLastExportedFilename] = useState<string | null>(null);
  const {
    activeTool,
    addDecorationLayer,
    addTextLayer,
    applyEnhanceProfile,
    applyImagePreset,
    applyTextTemplate,
    centerLayer,
    document,
    duplicateLayer,
    historyFuture,
    historyPast,
    importImage,
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
    toggleLayerLock,
    toggleLayerVisibility,
    undo,
    updateDecorationFill,
    updateDecorationShape,
    updateExportConfig,
    updateImageCrop,
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
  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;
  const viewport = document.canvas.viewport;

  useEffect(() => {
    setLastAutoSavedAt(document.draftMeta.lastSavedAt);
  }, [document.draftMeta.lastSavedAt]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await importImage(file);
    event.target.value = "";
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const result = await exportDocument(document);
      recordWorkflowExport();
      setLastExportedFilename(result.filename);
    } finally {
      setIsExporting(false);
    }
  };

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

  useEffect(() => {
    if (!document.draftMeta.enabled) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        window.localStorage.setItem(
          document.draftMeta.storageKey,
          JSON.stringify({
            ...document,
            draftMeta: {
              ...document.draftMeta,
              lastSavedAt: savedAt
            }
          })
        );
        setLastAutoSavedAt(savedAt);
      } catch {
        // Ignore storage quota and private-mode errors for now.
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [document]);

  return (
    <div className="workspace">
      <aside className="workspace__column">
        <section className="workspace__section">
          <h2>本轮目标</h2>
          <div className="workspace__metrics">
            <div className="workspace__metric">
              <span>当前链路</span>
              <strong>导入到导出</strong>
            </div>
            <div className="workspace__metric">
              <span>可投放比例</span>
              <strong>{document.canvas.presetId}</strong>
            </div>
          </div>
          <p className="workspace__hint">
            这版优先解决“AI 初稿不满意但还值得继续修”的高频场景：裁剪适配、花字包装、商品滤镜和稳定导出。
          </p>
        </section>

        <section className="workspace__section">
          <h3>任务入口</h3>
          <div className="workspace__tool-stack">
            {toolItems.map((tool) => (
              <button
                key={tool.id}
                className={`workspace__tool-button workspace__tool-button--stack ${
                  activeTool === tool.id ? "is-active" : ""
                }`}
                onClick={() => setActiveTool(tool.id)}
                type="button"
              >
                <strong>{tool.label}</strong>
                <span>{tool.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="workspace__section">
          <div className="workspace__section-header">
            <h3>图层列表</h3>
            <div className="workspace__inline-actions">
              <button
                className="workspace__tool-button workspace__tool-button--small"
                onClick={handleImportClick}
                type="button"
              >
                导入图片
              </button>
              <button
                className="workspace__tool-button workspace__tool-button--small"
                onClick={addTextLayer}
                type="button"
              >
                新增花字
              </button>
              <button
                className="workspace__tool-button workspace__tool-button--small"
                onClick={addDecorationLayer}
                type="button"
              >
                新增装饰
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
                  <button
                    className="workspace__layer-button"
                    onClick={() => selectLayer(layer.id)}
                    type="button"
                  >
                    <div className="workspace__layer-row">
                      <strong>{layer.name}</strong>
                      <span className="workspace__chip">Z{layer.zIndex}</span>
                    </div>
                    <div className="workspace__layer-meta">
                      <span className="workspace__chip">
                        {layerTypeLabels[layer.type]}
                      </span>
                      <span className="workspace__chip">
                        {layer.visible ? "可见" : "隐藏"}
                      </span>
                      <span className="workspace__chip">
                        {layer.locked ? "锁定" : "可编辑"}
                      </span>
                    </div>
                  </button>
                  <div className="workspace__layer-actions">
                    <button
                      className="workspace__action-button"
                      onClick={() => toggleLayerVisibility(layer.id)}
                      type="button"
                    >
                      {layer.visible ? "隐藏" : "显示"}
                    </button>
                    <button
                      className="workspace__action-button"
                      onClick={() => toggleLayerLock(layer.id)}
                      type="button"
                    >
                      {layer.locked ? "解锁" : "锁定"}
                    </button>
                    <button
                      className="workspace__action-button"
                      onClick={() => moveLayer(layer.id, "up")}
                      type="button"
                    >
                      上移
                    </button>
                    <button
                      className="workspace__action-button"
                      onClick={() => moveLayer(layer.id, "down")}
                      type="button"
                    >
                      下移
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
              <h2>画布工作区</h2>
              <p className="workspace__meta">
                {document.workflowMeta.sceneTag} · {document.canvas.width} ×{" "}
                {document.canvas.height}
              </p>
            </div>
            <div className="workspace__toolbar-actions">
              <button
                className="workspace__tool-button"
                disabled={!canUndo}
                onClick={undo}
                type="button"
              >
                撤销
              </button>
              <button
                className="workspace__tool-button"
                disabled={!canRedo}
                onClick={redo}
                type="button"
              >
                重做
              </button>
              <button
                className="workspace__tool-button"
                onClick={handleImportClick}
                type="button"
              >
                添加图片层
              </button>
              <button className="workspace__tool-button" onClick={addTextLayer} type="button">
                快速加卖点花字
              </button>
              <button
                className="workspace__export-button"
                disabled={isExporting}
                onClick={() => void handleExport()}
                type="button"
              >
                {isExporting ? "导出中..." : "导出投放成品"}
              </button>
            </div>
          </div>

          <CanvasViewport
            activeTool={activeTool}
            document={document}
            onSelectionChange={setSelectedLayerIds}
            onTransformChange={updateLayerTransform}
            onViewportChange={setCanvasViewport}
            selectedLayerIds={selectedLayerIds}
          />
        </section>

        <section className="workspace__statusbar">
          <div className="workspace__status-group">
            <span>选中图层：{selectedLayer?.name ?? "无"}</span>
            <span>
              草稿：
              {document.draftMeta.enabled
                ? lastAutoSavedAt
                  ? `已保存 ${new Date(lastAutoSavedAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}`
                  : "已启用"
                : "未启用"}
            </span>
            <span>
              导出版本：v{String(document.workflowMeta.version).padStart(3, "0")}
            </span>
          </div>
          <div className="workspace__status-group">
            <span>安全区：{document.canvas.safeAreaInset}px</span>
            <span>Zoom：{Math.round(viewport.zoom * 100)}%</span>
            <span>
              Pan：{Math.round(viewport.panX)} / {Math.round(viewport.panY)}
            </span>
            <span>历史：{historyPast.length}/{historyFuture.length}</span>
          </div>
        </section>
      </main>

      <aside className="workspace__panel">
        <section className="workspace__section">
          <h3>导出与流程</h3>
          <div className="workspace__property-list">
            <div className="workspace__property">
              <div className="workspace__property-label">流程场景</div>
              <div className="workspace__property-value">
                {document.workflowMeta.sceneTag}
              </div>
              <p className="workspace__footer-note">
                导出文件名会自动带上比例和版本号，方便回到图文流程继续使用。
              </p>
            </div>
            <label className="workspace__property">
              <span className="workspace__property-label">导出格式</span>
              <select
                className="workspace__select"
                onChange={(event) =>
                  updateExportConfig({
                    format: event.target.value as "png" | "jpeg"
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
                onChange={(event) =>
                  updateExportConfig({
                    scale: Number(event.target.value)
                  })
                }
                step={0.5}
                type="range"
                value={document.exportConfig.scale}
              />
              <div className="workspace__property-value">
                {document.exportConfig.scale.toFixed(1)}x
              </div>
            </label>
            <label className="workspace__property">
              <span className="workspace__property-label">导出质量</span>
              <input
                className="workspace__range"
                max={1}
                min={0.6}
                onChange={(event) =>
                  updateExportConfig({
                    quality: Number(event.target.value)
                  })
                }
                step={0.01}
                type="range"
                value={document.exportConfig.quality}
              />
              <div className="workspace__property-value">
                {Math.round(document.exportConfig.quality * 100)}%
              </div>
            </label>
            {lastExportedFilename ? (
              <p className="workspace__footer-note">
                最近导出：{lastExportedFilename}
              </p>
            ) : null}
          </div>
        </section>

        <section className="workspace__section">
          <h2>比例与视口</h2>
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
                <div className="workspace__meta">
                  {preset.width} × {preset.height}
                </div>
                <div className="workspace__meta">{preset.scene}</div>
              </button>
            ))}
          </div>
          <div className="workspace__property-list workspace__property-list--tight">
            <label className="workspace__property">
              <span className="workspace__property-label">视口缩放</span>
              <input
                aria-label="zoom"
                className="workspace__range"
                max={1.2}
                min={0.3}
                onChange={(event) =>
                  setCanvasViewport({
                    zoom: Number(event.target.value)
                  })
                }
                step={0.01}
                type="range"
                value={viewport.zoom}
              />
              <div className="workspace__property-value">
                {Math.round(viewport.zoom * 100)}%
              </div>
            </label>
            <div className="workspace__inline-actions">
              <button
                className="workspace__action-button"
                onClick={() =>
                  setCanvasViewport({
                    panX: 0,
                    panY: 0
                  })
                }
                type="button"
              >
                视口回中
              </button>
              <button
                className="workspace__action-button"
                onClick={() => setActiveTool("hand")}
                type="button"
              >
                切到平移模式
              </button>
            </div>
          </div>
        </section>

        <section className="workspace__section">
          <div className="workspace__section-header">
            <h3>属性面板</h3>
            {selectedLayer ? (
              <div className="workspace__inline-actions">
                <button
                  className="workspace__action-button"
                  onClick={() => duplicateLayer(selectedLayer.id)}
                  type="button"
                >
                  复制
                </button>
                <button
                  className="workspace__action-button workspace__action-button--danger"
                  onClick={() => removeLayer(selectedLayer.id)}
                  type="button"
                >
                  删除
                </button>
              </div>
            ) : null}
          </div>
          {selectedLayer ? (
            <div className="workspace__property-list">
              <label className="workspace__property">
                <span className="workspace__property-label">图层名称</span>
                <input
                  className="workspace__text-input"
                  onChange={(event) =>
                    updateLayerName(selectedLayer.id, event.target.value)
                  }
                  type="text"
                  value={selectedLayer.name}
                />
              </label>
              <div className="workspace__property">
                <div className="workspace__property-label">图层类型</div>
                <div className="workspace__property-value">
                  {layerTypeLabels[selectedLayer.type]}
                </div>
              </div>
              <label className="workspace__property">
                <span className="workspace__property-label">透明度</span>
                <input
                  className="workspace__range"
                  max={1}
                  min={0.1}
                  onChange={(event) =>
                    updateLayerOpacity(selectedLayer.id, Number(event.target.value))
                  }
                  step={0.01}
                  type="range"
                  value={selectedLayer.opacity}
                />
                <div className="workspace__property-value">
                  {Math.round(selectedLayer.opacity * 100)}%
                </div>
              </label>
              <div className="workspace__property">
                <div className="workspace__property-label">对齐辅助</div>
                <div className="workspace__inline-actions">
                  <button
                    className="workspace__action-button"
                    onClick={() => centerLayer(selectedLayer.id, "horizontal")}
                    type="button"
                  >
                    水平居中
                  </button>
                  <button
                    className="workspace__action-button"
                    onClick={() => centerLayer(selectedLayer.id, "vertical")}
                    type="button"
                  >
                    垂直居中
                  </button>
                </div>
              </div>
              <label className="workspace__property">
                <span className="workspace__property-label">缩放</span>
                <input
                  className="workspace__range"
                  max={1.8}
                  min={0.3}
                  onChange={(event) => {
                    const scale = Number(event.target.value);
                    updateLayerTransform(selectedLayer.id, {
                      scaleX: scale,
                      scaleY: scale
                    });
                  }}
                  step={0.01}
                  type="range"
                  value={selectedLayer.transform.scaleX}
                />
                <div className="workspace__property-value">
                  {Math.round(selectedLayer.transform.scaleX * 100)}%
                </div>
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
                <div className="workspace__property-value">
                  {selectedLayer.transform.rotation}°
                </div>
              </label>
              <div className="workspace__property">
                <div className="workspace__property-label">翻转</div>
                <div className="workspace__inline-actions">
                  <button
                    className="workspace__action-button"
                    onClick={() =>
                      updateLayerTransform(selectedLayer.id, {
                        flipX: !selectedLayer.transform.flipX
                      })
                    }
                    type="button"
                  >
                    {selectedLayer.transform.flipX ? "取消水平翻转" : "水平翻转"}
                  </button>
                  <button
                    className="workspace__action-button"
                    onClick={() =>
                      updateLayerTransform(selectedLayer.id, {
                        flipY: !selectedLayer.transform.flipY
                      })
                    }
                    type="button"
                  >
                    {selectedLayer.transform.flipY ? "取消垂直翻转" : "垂直翻转"}
                  </button>
                </div>
              </div>

              {selectedImageLayer ? (
                <>
                  <div className="workspace__property">
                    <div className="workspace__property-label">裁剪适配投放</div>
                    <div className="workspace__button-grid">
                      {cropAspectOptions.map((option) => (
                        <button
                          key={option.label}
                          className="workspace__action-button"
                          onClick={() => {
                            setActiveTool("crop");
                            setImageCropAspect(selectedImageLayer.id, option.value);
                          }}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <p className="workspace__footer-note">
                      当前裁剪区域：{selectedImageLayer.crop.width} ×{" "}
                      {selectedImageLayer.crop.height}，建议配合安全区检查标题和卖点位置。
                    </p>
                  </div>
                  <label className="workspace__property">
                    <span className="workspace__property-label">裁剪 X</span>
                    <input
                      className="workspace__range"
                      max={Math.max(
                        0,
                        selectedImageLayer.originalWidth - selectedImageLayer.crop.width
                      )}
                      min={0}
                      onChange={(event) =>
                        updateImageCrop(selectedImageLayer.id, {
                          x: Number(event.target.value)
                        })
                      }
                      step={1}
                      type="range"
                      value={selectedImageLayer.crop.x}
                    />
                    <div className="workspace__property-value">{selectedImageLayer.crop.x}px</div>
                  </label>
                  <label className="workspace__property">
                    <span className="workspace__property-label">裁剪 Y</span>
                    <input
                      className="workspace__range"
                      max={Math.max(
                        0,
                        selectedImageLayer.originalHeight - selectedImageLayer.crop.height
                      )}
                      min={0}
                      onChange={(event) =>
                        updateImageCrop(selectedImageLayer.id, {
                          y: Number(event.target.value)
                        })
                      }
                      step={1}
                      type="range"
                      value={selectedImageLayer.crop.y}
                    />
                    <div className="workspace__property-value">{selectedImageLayer.crop.y}px</div>
                  </label>
                  <label className="workspace__property">
                    <span className="workspace__property-label">裁剪宽度</span>
                    <input
                      className="workspace__range"
                      max={selectedImageLayer.originalWidth - selectedImageLayer.crop.x}
                      min={60}
                      onChange={(event) =>
                        updateImageCrop(selectedImageLayer.id, {
                          width: Number(event.target.value)
                        })
                      }
                      step={1}
                      type="range"
                      value={selectedImageLayer.crop.width}
                    />
                    <div className="workspace__property-value">
                      {selectedImageLayer.crop.width}px
                    </div>
                  </label>
                  <label className="workspace__property">
                    <span className="workspace__property-label">裁剪高度</span>
                    <input
                      className="workspace__range"
                      max={selectedImageLayer.originalHeight - selectedImageLayer.crop.y}
                      min={60}
                      onChange={(event) =>
                        updateImageCrop(selectedImageLayer.id, {
                          height: Number(event.target.value)
                        })
                      }
                      step={1}
                      type="range"
                      value={selectedImageLayer.crop.height}
                    />
                    <div className="workspace__property-value">
                      {selectedImageLayer.crop.height}px
                    </div>
                  </label>
                  <div className="workspace__inline-actions">
                    <button
                      className="workspace__action-button"
                      onClick={() => resetImageCrop(selectedImageLayer.id)}
                      type="button"
                    >
                      重置裁剪
                    </button>
                    <button
                      className="workspace__action-button"
                      onClick={() => setActiveTool("hand")}
                      type="button"
                    >
                      裁完去平移
                    </button>
                  </div>
                  <div className="workspace__property">
                    <div className="workspace__property-label">电商滤镜预设</div>
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
                    <div className="workspace__property-label">一键增强</div>
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
                        清空调整
                      </button>
                    </div>
                    <p className="workspace__footer-note">
                      当前为轻量增强策略，优先服务带货图首屏可读性和商品清晰度。
                    </p>
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
                      <div className="workspace__property-value">
                        {selectedImageLayer.filters[key].toFixed(2)}
                      </div>
                    </label>
                  ))}
                </>
              ) : null}

              {selectedTextLayer ? (
                <>
                  <div className="workspace__property">
                    <div className="workspace__property-label">高频花字模板</div>
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
                    <span className="workspace__property-label">花字内容</span>
                    <textarea
                      className="workspace__text-area"
                      onChange={(event) =>
                        updateTextContent(selectedTextLayer.id, event.target.value)
                      }
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
                    <div className="workspace__property-value">
                      {selectedTextLayer.style.fontSize}px
                    </div>
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
                  <div className="workspace__property">
                    <div className="workspace__property-label">花字样式</div>
                    <div className="workspace__swatch-grid">
                      <label className="workspace__swatch-field">
                        <span>主色</span>
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
                        <span>描边</span>
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
                      <label className="workspace__swatch-field">
                        <span>背景条</span>
                        <input
                          className="workspace__color-input"
                          onChange={(event) =>
                            updateTextStyle(selectedTextLayer.id, {
                              backgroundColor: event.target.value
                            })
                          }
                          type="color"
                          value={selectedTextLayer.style.backgroundColor}
                        />
                      </label>
                      <label className="workspace__swatch-field">
                        <span>渐变起点</span>
                        <input
                          className="workspace__color-input"
                          onChange={(event) =>
                            updateTextStyle(selectedTextLayer.id, {
                              gradient: [
                                event.target.value,
                                selectedTextLayer.style.gradient[1] ??
                                  selectedTextLayer.style.gradient[0] ??
                                  event.target.value
                              ]
                            })
                          }
                          type="color"
                          value={selectedTextLayer.style.gradient[0] ?? "#ff7c3f"}
                        />
                      </label>
                      <label className="workspace__swatch-field">
                        <span>渐变终点</span>
                        <input
                          className="workspace__color-input"
                          onChange={(event) =>
                            updateTextStyle(selectedTextLayer.id, {
                              gradient: [
                                selectedTextLayer.style.gradient[0] ??
                                  event.target.value,
                                event.target.value
                              ]
                            })
                          }
                          type="color"
                          value={selectedTextLayer.style.gradient[1] ?? "#f2be3f"}
                        />
                      </label>
                    </div>
                  </div>
                  <label className="workspace__property">
                    <span className="workspace__property-label">描边宽度</span>
                    <input
                      className="workspace__range"
                      max={16}
                      min={0}
                      onChange={(event) =>
                        updateTextStyle(selectedTextLayer.id, {
                          strokeWidth: Number(event.target.value)
                        })
                      }
                      step={1}
                      type="range"
                      value={selectedTextLayer.style.strokeWidth}
                    />
                    <div className="workspace__property-value">
                      {selectedTextLayer.style.strokeWidth}px
                    </div>
                  </label>
                  <label className="workspace__property">
                    <span className="workspace__property-label">阴影</span>
                    <input
                      className="workspace__text-input"
                      onChange={(event) =>
                        updateTextStyle(selectedTextLayer.id, {
                          shadow: event.target.value
                        })
                      }
                      placeholder="rgba(0,0,0,0.2) 0px 18px 32px"
                      type="text"
                      value={selectedTextLayer.style.shadow}
                    />
                  </label>
                </>
              ) : null}

              {selectedDecorationLayer ? (
                <>
                  <label className="workspace__property">
                    <span className="workspace__property-label">装饰形态</span>
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
                    <span className="workspace__property-label">装饰颜色</span>
                    <input
                      className="workspace__color-input workspace__color-input--wide"
                      onChange={(event) =>
                        updateDecorationFill(selectedDecorationLayer.id, event.target.value)
                      }
                      type="color"
                      value={selectedDecorationLayer.fill}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : (
            <p className="workspace__empty">选择一个图层后，这里会展示可编辑属性。</p>
          )}
        </section>
      </aside>
    </div>
  );
}
