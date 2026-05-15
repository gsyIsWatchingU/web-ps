import { create } from "zustand";
import {
  createDefaultTextStyle,
  createInitialDocument,
  createLayerId,
  getCanvasPreset,
  normalizeLayerOrder,
  type CanvasPresetId,
  type DecorationLayer,
  type EditorDocument,
  type EditorLayer,
  type ImageLayer,
  type LayerTransform,
  type TextLayer
} from "../model/document";
import { editorDocumentSchema } from "../model/document.schema";

type EditorTool = "select" | "text" | "shape" | "filter";
type LayerOrderDirection = "up" | "down";
type HistoryEntry = {
  document: EditorDocument;
  selectedLayerIds: string[];
};

type EditorStore = {
  activeTool: EditorTool;
  zoomPercent: number;
  selectedLayerIds: string[];
  document: EditorDocument;
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
  setActiveTool: (tool: EditorTool) => void;
  setCanvasPreset: (presetId: CanvasPresetId) => void;
  setZoomPercent: (value: number) => void;
  selectLayer: (layerId: string) => void;
  importImage: (file: File) => Promise<void>;
  addTextLayer: () => void;
  addDecorationLayer: () => void;
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
  updateTextContent: (layerId: string, content: string) => void;
  updateTextStyle: (
    layerId: string,
    style: Partial<TextLayer["style"]>
  ) => void;
  updateImageFilters: (
    layerId: string,
    filters: Partial<ImageLayer["filters"]>
  ) => void;
  updateDecorationShape: (layerId: string, shape: DecorationLayer["shape"]) => void;
  updateDecorationFill: (layerId: string, fill: string) => void;
  updateExportConfig: (config: Partial<EditorDocument["exportConfig"]>) => void;
  undo: () => void;
  redo: () => void;
};

const initialDocument = editorDocumentSchema.parse(createInitialDocument());
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

function loadImageMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file);

  return new Promise<{
    objectUrl: string;
    width: number;
    height: number;
  }>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        objectUrl,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    image.src = objectUrl;
  });
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

export const useEditorStore = create<EditorStore>((set) => ({
  activeTool: "select",
  zoomPercent: 72,
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
          layers: nextLayers
        })
      );
    }),
  setZoomPercent: (value) => set({ zoomPercent: value }),
  selectLayer: (layerId) => set({ selectedLayerIds: [layerId] }),
  importImage: async (file) => {
    const asset = await loadImageMetadata(file);

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
        source: asset.objectUrl,
        originalWidth: asset.width,
        originalHeight: asset.height,
        cropHint: "planned",
        filters: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          blur: 0,
          sharpen: 0,
          temperature: 0
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

      if (
        currentIndex === -1 ||
        targetIndex < 0 ||
        targetIndex >= sorted.length
      ) {
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
