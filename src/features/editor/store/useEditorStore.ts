import { create } from "zustand";
import {
  createDefaultImageFilters,
  createDefaultTextStyle,
  createImageCrop,
  createInitialDocument,
  createLayerId,
  getCanvasPreset,
  getEnhanceProfile,
  getImageFilterPreset,
  getTextTemplatePreset,
  normalizeLayerOrder,
  type CanvasPresetId,
  type CanvasViewport,
  type DecorationLayer,
  type EditorDocument,
  type EditorLayer,
  type EnhanceProfileId,
  type ImageCrop,
  type ImageLayer,
  type ImagePresetFilterId,
  type LayerTransform,
  type TextLayer,
  type TextTemplateId
} from "../model/document";
import { editorDocumentSchema } from "../model/document.schema";

export type EditorTool =
  | "select"
  | "hand"
  | "crop"
  | "text"
  | "shape"
  | "filter";

type LayerOrderDirection = "up" | "down";
type AlignmentAxis = "horizontal" | "vertical";
type HistoryEntry = {
  document: EditorDocument;
  selectedLayerIds: string[];
};

type EditorStore = {
  activeTool: EditorTool;
  selectedLayerIds: string[];
  document: EditorDocument;
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
  setActiveTool: (tool: EditorTool) => void;
  setCanvasPreset: (presetId: CanvasPresetId) => void;
  setCanvasViewport: (viewport: Partial<CanvasViewport>) => void;
  selectLayer: (layerId: string) => void;
  setSelectedLayerIds: (layerIds: string[]) => void;
  importImage: (file: File) => Promise<void>;
  addTextLayer: () => void;
  addDecorationLayer: () => void;
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
  updateTextStyle: (
    layerId: string,
    style: Partial<TextLayer["style"]>
  ) => void;
  updateImageFilters: (
    layerId: string,
    filters: Partial<ImageLayer["filters"]>
  ) => void;
  applyImagePreset: (layerId: string, presetId: ImagePresetFilterId) => void;
  applyEnhanceProfile: (layerId: string, profileId: EnhanceProfileId) => void;
  resetImageAdjustments: (layerId: string) => void;
  updateImageCrop: (layerId: string, crop: Partial<ImageCrop>) => void;
  setImageCropAspect: (layerId: string, aspectRatio: number | null) => void;
  resetImageCrop: (layerId: string) => void;
  updateDecorationShape: (layerId: string, shape: DecorationLayer["shape"]) => void;
  updateDecorationFill: (layerId: string, fill: string) => void;
  updateExportConfig: (config: Partial<EditorDocument["exportConfig"]>) => void;
  recordWorkflowExport: () => void;
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

function loadInitialDocument() {
  const fallback = createInitialDocument();

  if (typeof window === "undefined") {
    return editorDocumentSchema.parse(fallback);
  }

  try {
    const raw = window.localStorage.getItem(fallback.draftMeta.storageKey);

    if (!raw) {
      return editorDocumentSchema.parse(fallback);
    }

    const parsed = editorDocumentSchema.parse(JSON.parse(raw));

    return {
      ...parsed,
      workflowMeta: {
        ...parsed.workflowMeta,
        sceneTag: getCanvasPreset(parsed.canvas.presetId).scene
      }
    };
  } catch {
    return editorDocumentSchema.parse(fallback);
  }
}

const initialDocument = loadInitialDocument();

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

  const width = layer.shape === "highlight" ? 300 : 240;
  const height = layer.shape === "ribbon" ? 86 : 120;

  return {
    width: width * layer.transform.scaleX,
    height: height * layer.transform.scaleY
  };
}

export const useEditorStore = create<EditorStore>((set) => ({
  activeTool: "select",
  selectedLayerIds: [initialDocument.layers[1]?.id ?? initialDocument.layers[0].id],
  document: initialDocument,
  historyPast: [],
  historyFuture: [],
  setActiveTool: (tool) => set({ activeTool: tool }),
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
            safeAreaInset: Math.round(state.document.canvas.safeAreaInset * scaleFit)
          },
          workflowMeta: {
            ...state.document.workflowMeta,
            sceneTag: preset.scene
          },
          layers: nextLayers
        })
      );
    }),
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
        mask: {
          hasMaskPreview: false,
          strokes: 0
        }
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
          240,
          120
        ),
        shape: "highlight",
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
      const sorted = [...state.document.layers].sort((left, right) => left.zIndex - right.zIndex);
      const currentIndex = sorted.findIndex((layer) => layer.id === layerId);
      const targetIndex = direction === "up" ? currentIndex + 1 : currentIndex - 1;

      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= sorted.length) {
        return state;
      }

      const next = [...sorted];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];

      return commitDocumentChange(
        state,
        touchDocument(state.document, normalizeLayerOrder(next))
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
                  presetFilterId: null,
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
          layers.map((layer) => {
            if (layer.id !== layerId || layer.type !== "image") {
              return layer;
            }

            const nextCrop = {
              ...layer.crop,
              ...crop
            };
            const width = clamp(
              Math.round(nextCrop.width),
              1,
              layer.originalWidth - nextCrop.x
            );
            const height = clamp(
              Math.round(nextCrop.height),
              1,
              layer.originalHeight - nextCrop.y
            );
            const x = clamp(
              Math.round(nextCrop.x),
              0,
              layer.originalWidth - width
            );
            const y = clamp(
              Math.round(nextCrop.y),
              0,
              layer.originalHeight - height
            );

            return {
              ...layer,
              crop: {
                x,
                y,
                width,
                height
              }
            };
          })
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
  updateDecorationShape: (layerId, shape) =>
    set((state) =>
      commitDocumentChange(
        state,
        updateLayers(state.document, (layers) =>
          layers.map((layer) =>
            layer.id === layerId && layer.type === "decoration"
              ? {
                  ...layer,
                  shape
                }
              : layer
          )
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
    set((state) =>
      commitDocumentChange(state, {
        ...state.document,
        exportConfig: {
          ...state.document.exportConfig,
          ...config
        },
        updatedAt: new Date().toISOString()
      })
    ),
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
  undo: () =>
    set((state) => {
      const previous = state.historyPast.at(-1);

      if (!previous) {
        return state;
      }

      return {
        document: cloneDocument(previous.document),
        selectedLayerIds: [...previous.selectedLayerIds],
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
        historyPast: trimHistory([
          ...state.historyPast.map(cloneHistoryEntry),
          createHistoryEntry(state.document, state.selectedLayerIds)
        ]),
        historyFuture: rest.map(cloneHistoryEntry)
      };
    })
}));
