import { create } from "zustand";
import {
  type CanvasBackgroundMode,
  createDefaultExportConfig,
  createDefaultDoodleStyle,
  createDefaultImageAiMeta,
  createDefaultImageFilters,
  createDefaultTextStyle,
  createImageCrop,
  createInitialDocument,
  createLayerId,
  getCanvasPreset,
  getDecorationDefaultSize,
  getDefaultSafeAreaInset,
  getEnhanceProfile,
  getImageFilterPreset,
  getTextTemplatePreset,
  normalizeLayerOrder,
  type CanvasPresetId,
  type CanvasViewport,
  type DecorationKind,
  type DecorationLayer,
  type DecorationShapeId,
  type DecorationStickerId,
  type DoodleLayer,
  type DoodlePoint,
  type EditorDocument,
  type EditorLayer,
  type EditorTool,
  type EnhanceProfileId,
  type ImageCrop,
  type ImageLayer,
  type ImagePresetFilterId,
  type LayerTransform,
  type RepairStroke,
  type TextLayer,
  type TextTemplateId
} from "../model/document";
import { editorDocumentSchema } from "../model/document.schema";
import { runSeed3dTask } from "../runtime/aiBridge";
import {
  buildRepairPrompt,
  type RepairMode,
  analyzeRepairMask,
  getImageSizeFromSource,
  renderImageLayerCropDataUrl,
  renderRepairGuideDataUrl,
  renderRepairMaskDataUrl,
  runImageRepairTask
} from "../runtime/imageEditBridge";

type LayerOrderDirection = "up" | "down";
type AlignmentAxis = "horizontal" | "vertical";
type HistoryEntry = {
  document: EditorDocument;
  selectedLayerIds: string[];
};

type AsyncResult = {
  success: boolean;
  errorMessage: string | null;
};

type CropSession = {
  layerId: string;
  draft: ImageCrop;
} | null;

type RepairSession = {
  layerId: string;
  strokes: RepairStroke[];
  brushSize: number;
  feather: number;
  toolMode: "brush" | "eraser";
  guidePreviewEnabled: boolean;
  isSubmitting: boolean;
} | null;

type EditorStore = {
  activeTool: EditorTool;
  selectedLayerIds: string[];
  document: EditorDocument;
  cropSession: CropSession;
  repairSession: RepairSession;
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
  setActiveTool: (tool: EditorTool) => void;
  setCanvasPreset: (presetId: CanvasPresetId) => void;
  setCanvasDisplayBackground: (
    background: Partial<EditorDocument["canvas"]["displayBackground"]>
  ) => void;
  setCanvasViewport: (viewport: Partial<CanvasViewport>) => void;
  selectLayer: (layerId: string) => void;
  setSelectedLayerIds: (layerIds: string[]) => void;
  importImage: (file: File) => Promise<void>;
  addTextLayer: () => void;
  addDecorationLayer: () => void;
  addDoodleLayer: (
    points: DoodlePoint[],
    style?: Partial<Pick<DoodleLayer, "stroke" | "strokeWidth">>
  ) => void;
  applyTextTemplate: (layerId: string, templateId: TextTemplateId) => void;
  updateLayerName: (layerId: string, name: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  duplicateLayer: (layerId: string) => void;
  removeLayer: (layerId: string) => void;
  moveLayer: (layerId: string, direction: LayerOrderDirection) => void;
  updateLayerTransform: (
    layerId: string,
    transform: Partial<LayerTransform>
  ) => void;
  centerLayer: (layerId: string, axis: AlignmentAxis) => void;
  updateLayerOpacity: (layerId: string, opacity: number) => void;
  updateTextContent: (layerId: string, content: string) => void;
  updateTextStyle: (layerId: string, style: Partial<TextLayer["style"]>) => void;
  updateImageFilters: (layerId: string, filters: Partial<ImageLayer["filters"]>) => void;
  applyImagePreset: (layerId: string, presetId: ImagePresetFilterId) => void;
  applyEnhanceProfile: (layerId: string, profileId: EnhanceProfileId) => void;
  resetImageAdjustments: (layerId: string) => void;
  updateImageCrop: (layerId: string, crop: Partial<ImageCrop>) => void;
  setImageCropAspect: (layerId: string, aspectRatio: number | null) => void;
  resetImageCrop: (layerId: string) => void;
  updateDecorationKind: (layerId: string, decorationKind: DecorationKind) => void;
  updateDecorationShape: (layerId: string, shape: DecorationLayer["shape"]) => void;
  updateDecorationSticker: (layerId: string, sticker: DecorationLayer["sticker"]) => void;
  updateDecorationSize: (
    layerId: string,
    size: Partial<Pick<DecorationLayer, "width" | "height">>
  ) => void;
  updateDecorationFill: (layerId: string, fill: string) => void;
  updateDoodleStyle: (
    layerId: string,
    style: Partial<Pick<DoodleLayer, "stroke" | "strokeWidth" | "opacity">>
  ) => void;
  updateExportConfig: (config: Partial<EditorDocument["exportConfig"]>) => void;
  recordWorkflowExport: () => void;
  markWorkflowApplied: () => void;
  updateAiPrompt: (layerId: string, prompt: string) => void;
  updateAiExpandPrompt: (layerId: string, prompt: string) => void;
  updateRepairPrompt: (layerId: string, prompt: string) => void;
  startCropSession: (layerId: string) => void;
  updateCropSession: (crop: Partial<ImageCrop>) => void;
  commitCropSession: () => void;
  cancelCropSession: () => void;
  startRepairSession: (layerId: string) => void;
  appendRepairStroke: (points: RepairStroke["points"]) => void;
  clearRepairSession: () => void;
  undoRepairStroke: () => void;
  setRepairBrushSize: (size: number) => void;
  setRepairToolMode: (mode: NonNullable<RepairSession>["toolMode"]) => void;
  setRepairGuidePreviewEnabled: (enabled: boolean) => void;
  applyAiRepair: (layerId: string) => Promise<AsyncResult>;
  applyAi3d: (layerId: string, customUrl?: string) => Promise<AsyncResult>;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
};

const HISTORY_LIMIT = 60;

function touchDocument(document: EditorDocument, layers?: EditorLayer[]) {
  return {
    ...document,
    layers: layers ?? document.layers,
    updatedAt: new Date().toISOString()
  };
}

function updateLayers(
  document: EditorDocument,
  updater: (layers: EditorLayer[]) => EditorLayer[]
) {
  return touchDocument(document, updater(document.layers));
}

function cloneDocument(document: EditorDocument) {
  return structuredClone(document) as EditorDocument;
}

function cloneHistoryEntry(entry: HistoryEntry): HistoryEntry {
  return {
    document: cloneDocument(entry.document),
    selectedLayerIds: [...entry.selectedLayerIds]
  };
}

function createHistoryEntry(document: EditorDocument, selectedLayerIds: string[]): HistoryEntry {
  return {
    document: cloneDocument(document),
    selectedLayerIds: [...selectedLayerIds]
  };
}

function trimHistory(entries: HistoryEntry[]) {
  return entries.slice(-HISTORY_LIMIT);
}

function commitDocumentChange(
  state: EditorStore,
  document: EditorDocument,
  selectedLayerIds: string[] = state.selectedLayerIds,
  patch: Partial<EditorStore> = {}
) {
  return {
    ...patch,
    document,
    selectedLayerIds,
    historyPast: trimHistory([
      ...state.historyPast,
      createHistoryEntry(state.document, state.selectedLayerIds)
    ]),
    historyFuture: []
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clearDocumentLayers(document: EditorDocument) {
  return touchDocument({
    ...document,
    layers: []
  });
}

function loadImageAsset(file: File) {
  return new Promise<{
    source: string;
    width: number;
    height: number;
  }>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const source = typeof reader.result === "string" ? reader.result : null;

      if (!source) {
        reject(new Error(`Failed to read image: ${file.name}`));
        return;
      }

      const image = new Image();

      image.onload = () => {
        resolve({
          source,
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height
        });
      };

      image.onerror = () => {
        reject(new Error(`Failed to load image: ${file.name}`));
      };

      image.src = source;
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read image: ${file.name}`));
    };

    reader.readAsDataURL(file);
  });
}

function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法加载图片资源。"));
    image.src = source;
  });
}

async function getImageSize(source: string) {
  const image = await loadImageElement(source);

  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height
  };
}

function loadInitialDocument(): EditorDocument {
  const fallback = createInitialDocument();

  if (typeof window === "undefined") {
    return editorDocumentSchema.parse(fallback) as EditorDocument;
  }

  try {
    const raw = window.localStorage.getItem(fallback.draftMeta.storageKey);

    if (!raw) {
      return editorDocumentSchema.parse(fallback) as EditorDocument;
    }

    const parsed = editorDocumentSchema.parse(JSON.parse(raw)) as EditorDocument;

    const parsedExportConfig = parsed.exportConfig as Partial<EditorDocument["exportConfig"]> &
      Record<string, unknown>;
    const normalizedExportConfig: EditorDocument["exportConfig"] = {
      ...createDefaultExportConfig({
        width: parsed.canvas.width,
        height: parsed.canvas.height
      }),
      ...parsedExportConfig,
      qualityPreset: parsedExportConfig.qualityPreset === "standard" ? "standard" : "high",
      resizeMode: parsedExportConfig.resizeMode === "scale" ? "scale" : "fixed",
      sizePreset:
        parsedExportConfig.sizePreset === "free" ||
        parsedExportConfig.sizePreset === "1inch" ||
        parsedExportConfig.sizePreset === "2inch"
          ? parsedExportConfig.sizePreset
          : "group"
    };

    if (normalizedExportConfig.resizeMode === "fixed" && normalizedExportConfig.sizePreset === "group") {
      normalizedExportConfig.width = parsed.canvas.width;
      normalizedExportConfig.height = parsed.canvas.height;
    }

    return stripTransientDocumentState({
      ...parsed,
      exportConfig: normalizedExportConfig,
      workflowMeta: {
        ...parsed.workflowMeta,
        sceneTag: getCanvasPreset(parsed.canvas.presetId).scene
      }
    });
  } catch {
    return editorDocumentSchema.parse(fallback) as EditorDocument;
  }
}

const initialDocument: EditorDocument = loadInitialDocument();

function getDefaultSelectedLayerIds(document: EditorDocument) {
  const defaultLayerId = document.layers[1]?.id ?? document.layers[0]?.id;
  return defaultLayerId ? [defaultLayerId] : [];
}

function stripTransientDocumentState(document: EditorDocument): EditorDocument {
  return {
    ...document,
    canvas: {
      ...document.canvas,
      displayBackground: {
        mode: document.canvas.displayBackground?.mode ?? ("grid" satisfies CanvasBackgroundMode),
        color: document.canvas.displayBackground?.color ?? "#fbf6ef"
      },
      viewport: {
        zoom: 0.5,
        panX: 0,
        panY: 0
      }
    }
  };
}

function buildImageTransform(
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
) {
  const maxWidth = canvasWidth * 0.78;
  const maxHeight = canvasHeight * 0.62;
  const fitScale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
  const renderedWidth = imageWidth * fitScale;
  const renderedHeight = imageHeight * fitScale;

  return {
    x: Math.round((canvasWidth - renderedWidth) / 2),
    y: Math.round((canvasHeight - renderedHeight) / 2),
    scaleX: Number(fitScale.toFixed(3)),
    scaleY: Number(fitScale.toFixed(3)),
    rotation: 0,
    flipX: false,
    flipY: false
  } satisfies LayerTransform;
}

function createCenteredTransform(
  canvasWidth: number,
  canvasHeight: number,
  width: number,
  height: number
) {
  return {
    x: Math.round((canvasWidth - width) / 2),
    y: Math.round((canvasHeight - height) / 2),
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    flipX: false,
    flipY: false
  } satisfies LayerTransform;
}

function cloneLayer(layer: EditorLayer): EditorLayer {
  const cloned = structuredClone(layer) as EditorLayer;

  cloned.id = createLayerId(layer.type);
  cloned.name = `${layer.name} 副本`;
  cloned.transform.x += 32;
  cloned.transform.y += 32;

  return cloned;
}

function buildCropFromAspect(layer: ImageLayer, aspectRatio: number | null) {
  if (!aspectRatio) {
    return createImageCrop(layer.originalWidth, layer.originalHeight);
  }

  const originalRatio = layer.originalWidth / layer.originalHeight;
  let width = layer.originalWidth;
  let height = layer.originalHeight;

  if (originalRatio > aspectRatio) {
    width = Math.round(height * aspectRatio);
  } else {
    height = Math.round(width / aspectRatio);
  }

  return {
    x: Math.round((layer.originalWidth - width) / 2),
    y: Math.round((layer.originalHeight - height) / 2),
    width,
    height
  } satisfies ImageCrop;
}

function sanitizeImageCrop(layer: ImageLayer, crop: Partial<ImageCrop>) {
  const nextCrop = {
    ...layer.crop,
    ...crop
  };
  const width = clamp(Math.round(nextCrop.width), 1, layer.originalWidth - nextCrop.x);
  const height = clamp(Math.round(nextCrop.height), 1, layer.originalHeight - nextCrop.y);
  const x = clamp(Math.round(nextCrop.x), 0, layer.originalWidth - width);
  const y = clamp(Math.round(nextCrop.y), 0, layer.originalHeight - height);

  return {
    x,
    y,
    width,
    height
  } satisfies ImageCrop;
}

function sanitizeDecorationSize(size: Partial<Pick<DecorationLayer, "width" | "height">>) {
  return {
    width:
      size.width === undefined ? undefined : clamp(Math.round(size.width), 24, 1200),
    height:
      size.height === undefined ? undefined : clamp(Math.round(size.height), 24, 1200)
  };
}

function clampRepairBrushSize(size: number) {
  return clamp(Math.round(size), 4, 160);
}

function hasRepairMask(session: RepairSession) {
  return Boolean(session?.strokes.some((stroke) => stroke.mode === "paint" && stroke.points.length > 1));
}

function createDoodleLayer(
  points: DoodlePoint[],
  zIndex: number,
  styleOverride?: Partial<Pick<DoodleLayer, "stroke" | "strokeWidth">>
): DoodleLayer | null {
  if (points.length < 2) {
    return null;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const style = {
    ...createDefaultDoodleStyle(),
    ...styleOverride
  };

  return {
    id: createLayerId("doodle"),
    type: "doodle",
    name: "涂鸦标记",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex,
    transform: {
      x: minX,
      y: minY,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      flipX: false,
      flipY: false
    },
    points: points.map((point) => ({
      x: point.x - minX,
      y: point.y - minY
    })),
    stroke: style.stroke,
    strokeWidth: style.strokeWidth
  };
}

function getLayerSize(layer: EditorLayer) {
  if (layer.type === "image") {
    return {
      width: layer.crop.width * layer.transform.scaleX,
      height: layer.crop.height * layer.transform.scaleY
    };
  }

  if (layer.type === "text") {
    return {
      width: 560 * layer.transform.scaleX,
      height: layer.style.fontSize * 1.8 * layer.transform.scaleY
    };
  }

  if (layer.type === "doodle") {
    const maxX = Math.max(...layer.points.map((point) => point.x), 1);
    const maxY = Math.max(...layer.points.map((point) => point.y), 1);

    return {
      width: maxX * layer.transform.scaleX,
      height: maxY * layer.transform.scaleY
    };
  }

  return {
    width: layer.width * layer.transform.scaleX,
    height: layer.height * layer.transform.scaleY
  };
}

function layerSupportsAi(layer: ImageLayer) {
  return (
    layer.transform.rotation === 0 &&
    !layer.transform.flipX &&
    !layer.transform.flipY
  );
}

async function renderLayerCropDataUrl(layer: ImageLayer) {
  if (layer.source === "pending-upload") {
    throw new Error("请先导入图片后再执行 AI 操作。");
  }

  const image = await loadImageElement(layer.source);
  const canvas = window.document.createElement("canvas");

  canvas.width = layer.crop.width;
  canvas.height = layer.crop.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("无法创建图像画布。");
  }

  context.drawImage(
    image,
    layer.crop.x,
    layer.crop.y,
    layer.crop.width,
    layer.crop.height,
    0,
    0,
    layer.crop.width,
    layer.crop.height
  );

  return canvas.toDataURL("image/png");
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  activeTool: "select",
  selectedLayerIds: [initialDocument.layers[1]?.id ?? initialDocument.layers[0]?.id].filter(
    (layerId): layerId is string => Boolean(layerId)
  ),
  document: initialDocument,
  cropSession: null,
  repairSession: null,
  historyPast: [],
  historyFuture: [],
  setActiveTool: (tool) =>
    set((state) => ({
      activeTool: tool,
      cropSession: tool === "crop" ? state.cropSession : null,
      repairSession: tool === "repair" ? state.repairSession : null
    })),
  setCanvasPreset: (presetId) =>
    set((state) => {
      const preset = getCanvasPreset(presetId);
      const previousCanvas = state.document.canvas;
      const scaleX = preset.width / previousCanvas.width;
      const scaleY = preset.height / previousCanvas.height;
      const scaleFit = Math.min(scaleX, scaleY);
      const nextLayers = state.document.layers.map((layer) => ({
        ...layer,
        transform: {
          ...layer.transform,
          x: Math.round(layer.transform.x * scaleX),
          y: Math.round(layer.transform.y * scaleY),
          scaleX: Number((layer.transform.scaleX * scaleFit).toFixed(3)),
          scaleY: Number((layer.transform.scaleY * scaleFit).toFixed(3))
        }
      }));

      return commitDocumentChange(
        state,
        touchDocument({
          ...state.document,
          canvas: {
            ...state.document.canvas,
            presetId: preset.id,
            width: preset.width,
            height: preset.height,
            safeAreaInset: getDefaultSafeAreaInset(preset.width, preset.height)
          },
          workflowMeta: {
            ...state.document.workflowMeta,
            sceneTag: preset.scene
          },
          exportConfig:
            state.document.exportConfig.resizeMode === "fixed" &&
            state.document.exportConfig.sizePreset === "group"
              ? {
                  ...state.document.exportConfig,
                  width: preset.width,
                  height: preset.height
                }
              : state.document.exportConfig,
          layers: nextLayers
        })
      );
    }),
  setCanvasDisplayBackground: (background) =>
    set((state) => ({
      document: touchDocument({
        ...state.document,
        canvas: {
          ...state.document.canvas,
          displayBackground: {
            ...state.document.canvas.displayBackground,
            ...background
          }
        }
      })
    })),
  setCanvasViewport: (viewport) =>
    set((state) => ({
      document: {
        ...state.document,
        canvas: {
          ...state.document.canvas,
          viewport: {
            ...state.document.canvas.viewport,
            ...viewport
          }
        }
      }
    })),
  selectLayer: (layerId) => set({ selectedLayerIds: [layerId] }),
  setSelectedLayerIds: (layerIds) => set({ selectedLayerIds: layerIds }),
  importImage: async (file) => {
    const asset = await loadImageAsset(file);

    set((state) => {
      const nextLayer: EditorLayer = {
        id: createLayerId("image"),
        type: "image",
        name: file.name.replace(/\.[^.]+$/, "") || "导入图片",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: state.document.layers.length,
        transform: buildImageTransform(
          state.document.canvas.width,
          state.document.canvas.height,
          asset.width,
          asset.height
        ),
        source: asset.source,
        originalWidth: asset.width,
        originalHeight: asset.height,
        crop: createImageCrop(asset.width, asset.height),
        presetFilterId: null,
        enhanceProfileId: null,
        filters: createDefaultImageFilters(),
        aiMeta: createDefaultImageAiMeta()
      };
      const normalized = normalizeLayerOrder([...state.document.layers, nextLayer]);

      return commitDocumentChange(
        state,
        touchDocument(state.document, normalized),
        [nextLayer.id]
      );
    });
  },
  addTextLayer: () =>
    set((state) => {
      const nextLayer: TextLayer = {
        id: createLayerId("text"),
        type: "text",
        name: "新花字",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: state.document.layers.length,
        transform: createCenteredTransform(
          state.document.canvas.width,
          state.document.canvas.height,
          560,
          180
        ),
        content: "输入卖点文案",
        textTemplateId: null,
        style: createDefaultTextStyle()
      };
      const normalized = normalizeLayerOrder([...state.document.layers, nextLayer]);

      return commitDocumentChange(
        state,
        touchDocument(state.document, normalized),
        [nextLayer.id],
        { activeTool: "text" }
      );
    }),
  addDecorationLayer: () =>
    set((state) => {
      const defaultSize = getDecorationDefaultSize("shape", "heart");
      const nextLayer: DecorationLayer = {
        id: createLayerId("decoration"),
        type: "decoration",
        name: "新装饰层",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: state.document.layers.length,
        transform: createCenteredTransform(
          state.document.canvas.width,
          state.document.canvas.height,
          defaultSize.width,
          defaultSize.height
        ),
        decorationKind: "shape",
        shape: "heart",
        sticker: "sparkle",
        width: defaultSize.width,
        height: defaultSize.height,
        fill: "#cf5b2d"
      };
      const normalized = normalizeLayerOrder([...state.document.layers, nextLayer]);

      return commitDocumentChange(
        state,
        touchDocument(state.document, normalized),
        [nextLayer.id],
        { activeTool: "shape" }
      );
    }),
  addDoodleLayer: (points, style) =>
    set((state) => {
      const nextLayer = createDoodleLayer(points, state.document.layers.length, style);

      if (!nextLayer) {
        return state;
      }

      const normalized = normalizeLayerOrder([...state.document.layers, nextLayer]);

      return commitDocumentChange(
        state,
        touchDocument(state.document, normalized),
        [nextLayer.id],
        { activeTool: "select" }
      );
    }),
  applyTextTemplate: (layerId, templateId) =>
    set((state) => {
      const template = getTextTemplatePreset(templateId);

      return commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "text"
              ? {
                  ...layer,
                  name: template.name,
                  content: template.content,
                  textTemplateId: template.id,
                  style: {
                    ...layer.style,
                    ...template.style
                  }
                }
              : layer
          )
        ),
        [layerId]
      );
    }),
  updateLayerName: (layerId, name) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  name: name.trim() || layer.name
                }
              : layer
          )
        )
      )
    ),
  toggleLayerVisibility: (layerId) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  visible: !layer.visible
                }
              : layer
          )
        )
      )
    ),
  toggleLayerLock: (layerId) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  locked: !layer.locked
                }
              : layer
          )
        )
      )
    ),
  duplicateLayer: (layerId) =>
    set((state) => {
      const index = state.document.layers.findIndex((layer) => layer.id === layerId);

      if (index === -1) {
        return state;
      }

      const duplicated = cloneLayer(state.document.layers[index]);
      const layers = [...state.document.layers];
      layers.splice(index + 1, 0, duplicated);
      const normalized = normalizeLayerOrder(layers);

      return commitDocumentChange(
        state,
        touchDocument(state.document, normalized),
        [duplicated.id]
      );
    }),
  removeLayer: (layerId) =>
    set((state) => {
      if (state.document.layers.length <= 1) {
        return state;
      }

      const remaining = state.document.layers.filter((layer) => layer.id !== layerId);
      const normalized = normalizeLayerOrder(remaining);
      const fallbackSelection =
        normalized.find((layer) => layer.id !== layerId)?.id ?? normalized[0]?.id;

      return commitDocumentChange(
        state,
        touchDocument(state.document, normalized),
        fallbackSelection ? [fallbackSelection] : []
      );
    }),
  moveLayer: (layerId, direction) =>
    set((state) => {
      const sorted = [...state.document.layers].sort((left, right) => right.zIndex - left.zIndex);
      const currentIndex = sorted.findIndex((layer) => layer.id === layerId);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= sorted.length) {
        return state;
      }

      const next = [...sorted];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
      const reordered = next
        .map((layer, index, layers) => ({
          ...layer,
          zIndex: layers.length - index - 1
        }))
        .sort((left, right) => left.zIndex - right.zIndex);

      return commitDocumentChange(
        state,
        touchDocument(state.document, reordered)
      );
    }),
  updateLayerTransform: (layerId, transform) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  transform: {
                    ...layer.transform,
                    ...transform
                  }
                }
              : layer
          )
        )
      )
    ),
  centerLayer: (layerId, axis) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) => {
            if (layer.id !== layerId) {
              return layer;
            }

            const size = getLayerSize(layer);

            return {
              ...layer,
              transform: {
                ...layer.transform,
                x:
                  axis === "horizontal"
                    ? Math.round((state.document.canvas.width - size.width) / 2)
                    : layer.transform.x,
                y:
                  axis === "vertical"
                    ? Math.round((state.document.canvas.height - size.height) / 2)
                    : layer.transform.y
              }
            };
          })
        )
      )
    ),
  updateLayerOpacity: (layerId, opacity) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  opacity: clamp(opacity, 0, 1)
                }
              : layer
          )
        )
      )
    ),
  updateTextContent: (layerId, content) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "text"
              ? {
                  ...layer,
                  content
                }
              : layer
          )
        )
      )
    ),
  updateTextStyle: (layerId, style) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "text"
              ? {
                  ...layer,
                  style: {
                    ...layer.style,
                    ...style
                  }
                }
              : layer
          )
        )
      )
    ),
  updateImageFilters: (layerId, filters) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "image"
              ? {
                  ...layer,
                  enhanceProfileId: null,
                  filters: {
                    ...layer.filters,
                    ...filters
                  }
                }
              : layer
          )
        )
      )
    ),
  applyImagePreset: (layerId, presetId) =>
    set((state) => {
      const preset = getImageFilterPreset(presetId);

      return commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "image"
              ? {
                  ...layer,
                  presetFilterId: preset.id,
                  enhanceProfileId: null,
                  filters: preset.filters
                }
              : layer
          )
        )
      );
    }),
  applyEnhanceProfile: (layerId, profileId) =>
    set((state) => {
      const profile = getEnhanceProfile(profileId);

      return commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "image"
              ? {
                  ...layer,
                  enhanceProfileId: profile.id,
                  filters: profile.filters
                }
              : layer
          )
        )
      );
    }),
  resetImageAdjustments: (layerId) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "image"
              ? {
                  ...layer,
                  presetFilterId: null,
                  enhanceProfileId: null,
                  filters: createDefaultImageFilters()
                }
              : layer
          )
        )
      )
    ),
  updateImageCrop: (layerId, crop) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "image"
              ? {
                  ...layer,
                  crop: sanitizeImageCrop(layer, crop)
                }
              : layer
          )
        )
      )
    ),
  setImageCropAspect: (layerId, aspectRatio) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "image"
              ? {
                  ...layer,
                  crop: buildCropFromAspect(layer, aspectRatio)
                }
              : layer
          )
        )
      )
    ),
  resetImageCrop: (layerId) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "image"
              ? {
                  ...layer,
                  crop: createImageCrop(layer.originalWidth, layer.originalHeight)
                }
              : layer
          )
        )
      )
    ),
  updateDecorationKind: (layerId, decorationKind) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) => {
            if (layer.id !== layerId || layer.type !== "decoration") {
              return layer;
            }

            const defaultSize = getDecorationDefaultSize(decorationKind, layer.shape);

            return {
              ...layer,
              decorationKind,
              width: defaultSize.width,
              height: defaultSize.height
            };
          })
        )
      )
    ),
  updateDoodleStyle: (layerId, style) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "doodle"
              ? {
                  ...layer,
                  stroke: style.stroke ?? layer.stroke,
                  strokeWidth: style.strokeWidth ?? layer.strokeWidth,
                  opacity: style.opacity ?? layer.opacity
                }
              : layer
          )
        )
      )
    ),
  updateDecorationShape: (layerId, shape) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) => {
            if (layer.id !== layerId || layer.type !== "decoration") {
              return layer;
            }

            const defaultSize = getDecorationDefaultSize(layer.decorationKind, shape);

            return {
              ...layer,
              shape,
              width: layer.decorationKind === "shape" ? defaultSize.width : layer.width,
              height: layer.decorationKind === "shape" ? defaultSize.height : layer.height
            };
          })
        )
      )
    ),
  updateDecorationSticker: (layerId, sticker) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "decoration"
              ? {
                  ...layer,
                  sticker
                }
              : layer
          )
        )
      )
    ),
  updateDecorationSize: (layerId, size) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) => {
            if (layer.id !== layerId || layer.type !== "decoration") {
              return layer;
            }

            const nextSize = sanitizeDecorationSize(size);

            return {
              ...layer,
              width: nextSize.width ?? layer.width,
              height: nextSize.height ?? layer.height
            };
          })
        )
      )
    ),
  updateDecorationFill: (layerId, fill) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "decoration"
              ? {
                  ...layer,
                  fill
                }
              : layer
          )
        )
      )
    ),
  updateExportConfig: (config) =>
    set((state) => {
      const mergedExportConfig = {
        ...state.document.exportConfig,
        ...config
      };

      if ("qualityPreset" in config) {
        mergedExportConfig.quality = config.qualityPreset === "high" ? 0.92 : 0.82;
      }

      if ("scalePercent" in config) {
        mergedExportConfig.scale = mergedExportConfig.scalePercent / 100;
      }

      return commitDocumentChange(state, {
        ...state.document,
        exportConfig: mergedExportConfig,
        updatedAt: new Date().toISOString()
      });
    }),
  recordWorkflowExport: () =>
    set((state) => ({
      document: {
        ...state.document,
        workflowMeta: {
          ...state.document.workflowMeta,
          version: state.document.workflowMeta.version + 1,
          lastExportedAt: new Date().toISOString()
        }
      }
    })),
  markWorkflowApplied: () =>
    set((state) => ({
      document: {
        ...state.document,
        workflowMeta: {
          ...state.document.workflowMeta,
          lastAppliedAt: new Date().toISOString()
        }
      }
    })),
  updateAiPrompt: (layerId, prompt) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "image"
              ? {
                  ...layer,
                  aiMeta: {
                    ...layer.aiMeta,
                    prompt
                  }
                }
              : layer
          )
        )
      )
    ),
  updateAiExpandPrompt: (layerId, prompt) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "image"
              ? {
                  ...layer,
                  aiMeta: {
                    ...layer.aiMeta,
                    expandPrompt: prompt
                  }
                }
              : layer
          )
        )
      )
    ),
  updateRepairPrompt: (layerId, prompt) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "image"
              ? {
                  ...layer,
                  aiMeta: {
                    ...layer.aiMeta,
                    repairPrompt: prompt
                  }
                }
              : layer
          )
        )
      )
    ),
  
  startCropSession: (layerId) =>
    set((state) => {
      const layer = state.document.layers.find(
        (entry): entry is ImageLayer => entry.id === layerId && entry.type === "image"
      );

      if (!layer) {
        return {
          cropSession: null
        };
      }

      return {
        cropSession: {
          layerId,
          draft: { ...layer.crop }
        }
      };
    }),
  updateCropSession: (crop) =>
    set((state) => {
      if (!state.cropSession) {
        return state;
      }

      const layer = state.document.layers.find(
        (entry): entry is ImageLayer =>
          entry.id === state.cropSession?.layerId && entry.type === "image"
      );

      if (!layer) {
        return {
          cropSession: null
        };
      }

      return {
        cropSession: {
          ...state.cropSession,
          draft: sanitizeImageCrop(layer, {
            ...state.cropSession.draft,
            ...crop
          })
        }
      };
    }),
  commitCropSession: () =>
    set((state) => {
      if (!state.cropSession) {
        return state;
      }

      return commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === state.cropSession?.layerId && layer.type === "image"
              ? {
                  ...layer,
                  crop: state.cropSession.draft
                }
              : layer
          )
        ),
        state.selectedLayerIds,
        {
          cropSession: null,
          activeTool: "select"
        }
      );
    }),
  cancelCropSession: () =>
    set(() => ({
      cropSession: null,
      activeTool: "select"
    })),
  startRepairSession: (layerId) =>
    set((state) => {
      const layer = state.document.layers.find(
        (entry): entry is ImageLayer => entry.id === layerId && entry.type === "image"
      );

      if (!layer) {
        return {
          repairSession: null
        };
      }

      return {
        repairSession: {
          layerId,
          strokes: [],
          brushSize: state.repairSession?.layerId === layerId ? state.repairSession.brushSize : 24,
          feather: state.repairSession?.layerId === layerId ? state.repairSession.feather : 0,
          toolMode: state.repairSession?.layerId === layerId ? state.repairSession.toolMode : "brush",
          guidePreviewEnabled:
            state.repairSession?.layerId === layerId ? state.repairSession.guidePreviewEnabled : true,
          isSubmitting: false
        }
      };
    }),
  appendRepairStroke: (points) =>
    set((state) => {
      if (!state.repairSession || points.length < 2) {
        return state;
      }

      return {
        repairSession: {
          ...state.repairSession,
          strokes: [
            ...state.repairSession.strokes,
            {
              points,
              brushSize: state.repairSession.brushSize,
              mode: state.repairSession.toolMode === "eraser" ? "erase" : "paint"
            }
          ]
        }
      };
    }),
  clearRepairSession: () =>
    set((state) => {
      if (!state.repairSession) {
        return state;
      }

      return {
        repairSession: {
          ...state.repairSession,
          strokes: [],
          isSubmitting: false
        }
      };
    }),
  undoRepairStroke: () =>
    set((state) => {
      if (!state.repairSession || state.repairSession.strokes.length === 0) {
        return state;
      }

      return {
        repairSession: {
          ...state.repairSession,
          strokes: state.repairSession.strokes.slice(0, -1)
        }
      };
    }),
  setRepairBrushSize: (size) =>
    set((state) => {
      if (!state.repairSession) {
        return state;
      }

      return {
        repairSession: {
          ...state.repairSession,
          brushSize: clampRepairBrushSize(size)
        }
      };
    }),
  setRepairToolMode: (mode) =>
    set((state) => {
      if (!state.repairSession) {
        return state;
      }

      return {
        repairSession: {
          ...state.repairSession,
          toolMode: mode
        }
      };
    }),
  setRepairGuidePreviewEnabled: (enabled) =>
    set((state) => {
      if (!state.repairSession) {
        return state;
      }

      return {
        repairSession: {
          ...state.repairSession,
          guidePreviewEnabled: enabled
        }
      };
    }),
  applyAiRepair: async (layerId) => {
    const state = get();
    const layer = state.document.layers.find(
      (entry): entry is ImageLayer => entry.id === layerId && entry.type === "image"
    );

    if (!layer) {
      return { success: false, errorMessage: "Please select an image layer first." };
    }

    if (layer.transform.rotation !== 0 || layer.transform.flipX || layer.transform.flipY) {
      return {
        success: false,
        errorMessage: "局部重绘当前仅支持未旋转、未翻转的图片图层。"
      };
    }

    if (!state.repairSession || state.repairSession.layerId !== layerId || !hasRepairMask(state.repairSession)) {
      return { success: false, errorMessage: "请先在画布上框选需要调整的区域。" };
    }

    set((current) => ({
      repairSession:
        current.repairSession && current.repairSession.layerId === layerId
          ? {
              ...current.repairSession,
              isSubmitting: true
            }
          : current.repairSession,
      document: updateLayers(current.document, (layers) =>
        layers.map((entry) =>
          entry.id === layerId && entry.type === "image"
            ? {
                ...entry,
                aiMeta: {
                  ...entry.aiMeta,
                  lastAiAction: "repair",
                  lastAiRequestedAt: new Date().toISOString(),
                  lastAiError: null,
                  repairTask: {
                    taskId: null,
                    status: "pending",
                    resultUrl: null,
                    providerModel: null,
                    errorMessage: null
                  }
                }
              }
            : entry
        )
      )
    }));

    try {
      const imageDataUrl = await renderImageLayerCropDataUrl(layer);
      const maskDataUrl = await renderRepairMaskDataUrl(layer, state.repairSession.strokes);
      const guideDataUrl = await renderRepairGuideDataUrl(layer, state.repairSession.strokes);
      const maskAnalysis = await analyzeRepairMask(maskDataUrl);
      const prompt = buildRepairPrompt(layer, state.repairSession, maskAnalysis);
      const mode: RepairMode = "guided_repaint";
      const result = await runImageRepairTask({
        imageDataUrl,
        maskDataUrl,
        guideDataUrl,
        prompt,
        mode
      });

      if (result.status !== "succeeded" || !result.resultUrl) {
        set((current) => ({
          repairSession:
            current.repairSession && current.repairSession.layerId === layerId
              ? {
                  ...current.repairSession,
                  isSubmitting: false
                }
              : current.repairSession,
          document: updateLayers(current.document, (layers) =>
            layers.map((entry) =>
              entry.id === layerId && entry.type === "image"
                ? {
                    ...entry,
                    aiMeta: {
                      ...entry.aiMeta,
                      lastAiError: result.errorMessage,
                      repairTask: {
                        taskId: result.taskId,
                        status: result.status,
                        resultUrl: result.resultUrl,
                        providerModel: result.providerModel,
                        errorMessage: result.errorMessage
                      }
                    }
                  }
                : entry
            )
          )
        }));

        return { success: false, errorMessage: result.errorMessage ?? "局部重绘失败。" };
      }

      const size = await getImageSizeFromSource(result.resultUrl);

      set((current) => {
        const nextDocument = updateLayers(current.document, (layers) =>
          layers.map((entry) =>
            entry.id === layerId && entry.type === "image"
              ? {
                  ...entry,
                  source: result.resultUrl!,
                  originalWidth: size.width,
                  originalHeight: size.height,
                  crop: createImageCrop(size.width, size.height),
                  aiMeta: {
                    ...entry.aiMeta,
                    lastAiError: null,
                    lastAiSucceededAt: new Date().toISOString(),
                    repairTask: {
                      taskId: result.taskId,
                      status: result.status,
                      resultUrl: result.resultUrl,
                      providerModel: result.providerModel,
                      errorMessage: null
                    }
                  }
                }
              : entry
          )
        );

        return commitDocumentChange(current, nextDocument, current.selectedLayerIds, {
          repairSession: {
            layerId,
            strokes: [],
            brushSize: current.repairSession?.brushSize ?? 24,
            feather: current.repairSession?.feather ?? 0,
            toolMode: current.repairSession?.toolMode ?? "brush",
            guidePreviewEnabled: current.repairSession?.guidePreviewEnabled ?? true,
            isSubmitting: false
          }
        });
      });

      return { success: true, errorMessage: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "局部重绘失败。";

      set((current) => ({
        repairSession:
          current.repairSession && current.repairSession.layerId === layerId
            ? {
                ...current.repairSession,
                isSubmitting: false
              }
            : current.repairSession,
        document: updateLayers(current.document, (layers) =>
          layers.map((entry) =>
            entry.id === layerId && entry.type === "image"
              ? {
                  ...entry,
                  aiMeta: {
                    ...entry.aiMeta,
                    lastAiError: errorMessage,
                    repairTask: {
                      ...entry.aiMeta.repairTask,
                      status: "failed",
                      errorMessage
                    }
                  }
                }
              : entry
          )
        )
      }));

      return { success: false, errorMessage };
    }
  },
  applyAi3d: async (layerId, customUrl) => {
    const state = get();
    const layer = state.document.layers.find(
      (entry): entry is ImageLayer => entry.id === layerId && entry.type === "image"
    );

    if (!layer) {
      return { success: false, errorMessage: "请选择一个图片层。" };
    }

    const targetUrl = customUrl && (customUrl.startsWith("http://") || customUrl.startsWith("https://"))
      ? customUrl
      : layer.source;

    const isValidImageSource = 
      targetUrl.startsWith("http://") || 
      targetUrl.startsWith("https://") || 
      targetUrl.startsWith("data:image/");

    if (!isValidImageSource) {
      return {
        success: false,
        errorMessage: "请提供有效的图片。支持 http/https URL 或本地上传的图片。"
      };
    }

    try {
      const result = await runSeed3dTask(targetUrl, layer.aiMeta.prompt);

      set((current) => ({
        document: updateLayers(current.document, (layers) =>
          layers.map((entry) =>
            entry.id === layerId && entry.type === "image"
              ? {
                  ...entry,
                  aiMeta: {
                    ...entry.aiMeta,
                    lastAiAction: "seed3d",
                    lastAiRequestedAt: new Date().toISOString(),
                    model3dTask: {
                      taskId: result.taskId,
                      status: result.status,
                      downloadUrl: result.downloadUrl,
                      fileName: result.fileName,
                      providerModel: result.providerModel
                    },
                    lastAiError: result.status === "succeeded" ? null : result.errorMessage,
                    lastAiSucceededAt: result.status === "succeeded" ? new Date().toISOString() : entry.aiMeta.lastAiSucceededAt
                  }
                }
              : entry
          )
        )
      }));

      if (result.status === "succeeded") {
        return { success: true, errorMessage: null };
      }

      return { success: false, errorMessage: result.errorMessage ?? "立体创作失败。" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "立体创作失败。";

      set((current) => ({
        document: updateLayers(current.document, (layers) =>
          layers.map((entry) =>
            entry.id === layerId && entry.type === "image"
              ? {
                  ...entry,
                  aiMeta: {
                    ...entry.aiMeta,
                    model3dTask: {
                      ...entry.aiMeta.model3dTask,
                      status: "failed"
                    },
                    lastAiError: message
                  }
                }
              : entry
          )
        )
      }));

      return { success: false, errorMessage: message };
    }
  },
  clearCanvas: () =>
    set((state) => ({
      activeTool: "select",
      selectedLayerIds: [],
      document: clearDocumentLayers(state.document),
      cropSession: null,
      repairSession: null,
      historyPast: [],
      historyFuture: []
    })),
  undo: () =>
    set((state) => {
      const previous = state.historyPast.at(-1);

      if (!previous) {
        return state;
      }

      return {
        document: cloneDocument(previous.document),
        selectedLayerIds: [...previous.selectedLayerIds],
        cropSession: null,
        repairSession: null,
        historyPast: state.historyPast.slice(0, -1),
        historyFuture: [
          createHistoryEntry(state.document, state.selectedLayerIds),
          ...state.historyFuture.map(cloneHistoryEntry)
        ]
      };
    }),
  redo: () =>
    set((state) => {
      const [next, ...rest] = state.historyFuture;

      if (!next) {
        return state;
      }

      return {
        document: cloneDocument(next.document),
        selectedLayerIds: [...next.selectedLayerIds],
        cropSession: null,
        repairSession: null,
        historyPast: trimHistory([
          ...state.historyPast.map(cloneHistoryEntry),
          createHistoryEntry(state.document, state.selectedLayerIds)
        ]),
        historyFuture: rest.map(cloneHistoryEntry)
      };
    })
}));
