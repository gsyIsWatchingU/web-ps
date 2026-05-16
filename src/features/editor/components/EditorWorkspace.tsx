import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  canvasPresets,
  layerTypeLabels,
  type DecorationLayer,
  type EditorLayer,
  type TextLayer
} from "../model/document";
import { useEditorStore } from "../store/useEditorStore";
import { exportDocument } from "../runtime/exportDocument";
import { CanvasViewport } from "./CanvasViewport";

const toolItems = [
  { id: "select", label: "选择" },
  { id: "text", label: "花字" },
  { id: "shape", label: "图层" },
  { id: "filter", label: "滤镜" }
] as const;

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
  const {
    activeTool,
    addDecorationLayer,
    addTextLayer,
    document,
    duplicateLayer,
    importImage,
    historyFuture,
    historyPast,
    moveLayer,
    removeLayer,
    redo,
    selectedLayerIds,
    selectLayer,
    setSelectedLayerIds,
    setActiveTool,
    setCanvasPreset,
    toggleLayerLock,
    toggleLayerVisibility,
    undo,
    updateDecorationFill,
    updateDecorationShape,
    updateExportConfig,
    updateImageFilters,
    updateLayerName,
    updateTextContent,
    updateTextStyle,
    updateLayerTransform,
    zoomPercent,
    setZoomPercent
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
      await exportDocument(document);
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
          <h2>项目状态</h2>
          <div className="workspace__metrics">
            <div className="workspace__metric">
              <span>当前阶段</span>
              <strong>T1-T4 完成</strong>
            </div>
            <div className="workspace__metric">
              <span>图层数量</span>
              <strong>{document.layers.length}</strong>
            </div>
          </div>
          <p className="workspace__hint">
            当前版本已经具备画布比例切换、图片导入、基础变换和图层管理骨架，适合继续往花字、滤镜、历史栈和导出推进。
          </p>
        </section>

        <section className="workspace__section">
          <h3>工具区</h3>
          <div className="workspace__button-grid">
            {toolItems.map((tool) => (
              <button
                key={tool.id}
                className={`workspace__tool-button ${
                  activeTool === tool.id ? "is-active" : ""
                }`}
                onClick={() => setActiveTool(tool.id)}
                type="button"
              >
                {tool.label}
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
                当前比例 {document.canvas.presetId} · {document.canvas.width} ×{" "}
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
                添加花字层
              </button>
              <button
                className="workspace__export-button"
                disabled={isExporting}
                onClick={() => void handleExport()}
                type="button"
              >
                {isExporting
                  ? "导出中..."
                  : `导出 ${document.exportConfig.format.toUpperCase()}`}
              </button>
            </div>
          </div>

          <CanvasViewport
            document={document}
            onSelectionChange={setSelectedLayerIds}
            onTransformChange={updateLayerTransform}
            selectedLayerIds={selectedLayerIds}
            zoomPercent={zoomPercent}
          />
        </section>

        <section className="workspace__statusbar">
          <div className="workspace__status-group">
            <span>选中图层：{selectedLayer?.name ?? "无"}</span>
            <span>
              草稿：
              {document.draftMeta.enabled
                ? lastAutoSavedAt
                  ? `已保存 ${new Date(lastAutoSavedAt).toLocaleTimeString(
                      "zh-CN",
                      {
                        hour: "2-digit",
                        minute: "2-digit"
                      }
                    )}`
                  : "已启用"
                : "未启用"}
            </span>
            <span>导出：{document.exportConfig.format.toUpperCase()}</span>
          </div>
          <div className="workspace__status-group">
            <span>安全区：{document.canvas.safeAreaInset}px</span>
            <span>Zoom：{zoomPercent}%</span>
            <span>历史：{historyPast.length}/{historyFuture.length}</span>
          </div>
        </section>
      </main>

      <aside className="workspace__panel">
        <section className="workspace__section">
          <h3>导出设置</h3>
          <div className="workspace__property-list">
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
            <p className="workspace__footer-note">
              导出不会带安全区辅助线，PNG 适合高保真，JPEG 适合更轻量的投放素材。
            </p>
          </div>
        </section>

        <section className="workspace__section">
          <h2>画布比例</h2>
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
                <span className="workspace__property-label">缩放</span>
                <input
                  className="workspace__range"
                  max={1.6}
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
                <div className="workspace__property">
                  <div className="workspace__property-label">图片信息</div>
                  <div className="workspace__property-value">
                    {selectedImageLayer.originalWidth} ×{" "}
                    {selectedImageLayer.originalHeight}
                  </div>
                  <p className="workspace__footer-note">
                    裁切交互已预留扩展位，当前版本先支持导入、缩放、旋转和翻转。
                  </p>
                </div>
              ) : null}
              {selectedTextLayer ? (
                <>
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
                    <p className="workspace__footer-note">
                      支持 CSS 风格阴影字符串，方便快速微调花字立体感。
                    </p>
                  </label>
                </>
              ) : null}
              {selectedImageLayer ? (
                <>
                  <div className="workspace__property">
                    <div className="workspace__property-label">基础滤镜</div>
                    <p className="workspace__footer-note">
                      当前为实时预览调节，适合对 AIGC 初稿做快速色调和锐度微修。
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

        <section className="workspace__section">
          <h3>缩放预览</h3>
          <input
            aria-label="zoom"
            className="workspace__range"
            max={120}
            min={30}
            onChange={(event) => setZoomPercent(Number(event.target.value))}
            type="range"
            value={zoomPercent}
          />
          <p className="workspace__footer-note">
            当前缩放用于工作台预览，后续会继续接入更完整的画布缩放与平移控制。
          </p>
        </section>
      </aside>
    </div>
  );
}
