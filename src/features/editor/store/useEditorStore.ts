import { create } from "zustand";
import {
  type CanvasBackgroundMode,
  createDefaultAssetRegistry,
  createDefaultExportConfig,
  createDefaultCanvasViewport,
  createDefaultDoodleStyle,
  createDefaultImageAiMeta,
  createDefaultImageFilters,
  createDefaultRenderRequest,
  createDefaultTemplateMeta,
  createDefaultTextStyle,
  createDefaultValidationState,
  createImageCrop,
  createBlankDocument,
  createInitialDocument,
  createLayerId,
  getCanvasPreset,
  getDecorationDefaultSize,
  getDefaultSafeAreaInset,
  getEnhanceProfile,
  getImageFilterPreset,
  getImageLayerSource,
  getTextTemplatePreset,
  isPendingImageLayer,
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
import {
  applyPlatformPresetToDocument,
  createTemplateDocument,
  insertBusinessComponentLayer,
  type BusinessComponentPresetId,
  type PlatformPresetId,
  type TemplateDefinitionId,
  validateDocument
} from "../model/ecommerce";
import { editorDocumentSchema } from "../model/document.schema";
import { runSeed3dTask } from "../runtime/aiBridge";
import {
  BackendRequestError,
  hasBackendConfig,
  loadEditorDocument,
  saveEditorDocument,
  uploadImageAsset
} from "../runtime/backendBridge";
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

type SyncStatus = "idle" | "saving" | "saved" | "error";
type HydrationStatus = "booting" | "ready" | "error";

type EditorStore = {
  activeTool: EditorTool;
  selectedLayerIds: string[];
  document: EditorDocument;
  cropSession: CropSession;
  repairSession: RepairSession;
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  hydrationStatus: HydrationStatus;
  pendingServerSave: boolean;
  hydrateDocumentFromServer: () => Promise<void>;
  flushDocumentSave: (options?: { force?: boolean }) => Promise<boolean>;
  setActiveTool: (tool: EditorTool) => void;
  createDocumentFromTemplate: (templateId: TemplateDefinitionId) => void;
  createBlankDocument: (presetId: PlatformPresetId) => void;
  setPlatformPreset: (presetId: PlatformPresetId) => void;
  setCanvasPreset: (presetId: CanvasPresetId) => void;
  setCanvasDisplayBackground: (
    background: Partial<EditorDocument["canvas"]["displayBackground"]>
  ) => void;
  setCanvasSafeAreaInset: (inset: number) => void;
  setCanvasViewport: (viewport: Partial<CanvasViewport>) => void;
  selectLayer: (layerId: string) => void;
  setSelectedLayerIds: (layerIds: string[]) => void;
  importImage: (file: File) => Promise<void>;
  addTextLayer: () => void;
  addDecorationLayer: () => void;
  addBusinessComponent: (componentId: BusinessComponentPresetId) => void;
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
const SERVER_SYNC_CONFLICT_MESSAGE =
  "Cloud version changed remotely. Refresh or reopen this draft before syncing again.";
let inFlightDocumentSave: Promise<boolean> | null = null;
let queueDocumentSaveAfterCurrent = false;

function touchDocument(document: EditorDocument, layers?: EditorLayer[]) {
  return validateDocument({
    ...document,
    layers: layers ?? document.layers,
    version: document.version + 1,
    updatedAt: new Date().toISOString()
  });
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
    pendingServerSave: true,
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
    layers: [],
    assetRegistry: createDefaultAssetRegistry()
  });
}

function buildRenderRequest(document: EditorDocument) {
  return {
    ...document.renderRequest,
    format: document.exportConfig.format,
    quality: document.exportConfig.quality,
    qualityPreset: document.exportConfig.qualityPreset,
    resizeMode: document.exportConfig.resizeMode,
    sizePreset: document.exportConfig.sizePreset,
    width: document.exportConfig.width,
    height: document.exportConfig.height,
    scalePercent: document.exportConfig.scalePercent,
    background: {
      ...document.renderRequest.background,
      color: document.canvas.backgroundColor
    }
  };
}

function normalizeCommerceFields(document: EditorDocument): EditorDocument {
  return validateDocument({
    ...document,
    version: document.version ?? 1,
    renderRequest:
      document.renderRequest ??
      createDefaultRenderRequest(
        {
          width: document.canvas.width,
          height: document.canvas.height,
          backgroundColor: document.canvas.backgroundColor
        },
        document.exportConfig
      ),
    assetRegistry: document.assetRegistry ?? createDefaultAssetRegistry(),
    templateMeta: document.templateMeta ?? createDefaultTemplateMeta(),
    validation: document.validation ?? createDefaultValidationState()
  });
}

function loadImageAsset(file: File) {
  return new Promise<{
    sourceDataUrl: string;
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
          sourceDataUrl: source,
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
    return normalizeLoadedDocument(fallback);
  }

  try {
    return loadPersistedDraftDocument() ?? normalizeLoadedDocument(fallback);
  } catch {
    return normalizeLoadedDocument(fallback);
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
      viewport: createDefaultCanvasViewport()
    }
  };
}

function isTemporaryDocumentId(documentId: string | null | undefined) {
  return !documentId || documentId.startsWith("doc-") || documentId.startsWith("template-");
}

function normalizeLoadedDocument(document: EditorDocument) {
  const parsed = editorDocumentSchema.parse(document) as EditorDocument;
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

  return normalizeCommerceFields(
    stripTransientDocumentState({
      ...parsed,
      exportConfig: normalizedExportConfig,
      renderRequest:
        parsed.renderRequest ??
        createDefaultRenderRequest(
          {
            width: parsed.canvas.width,
            height: parsed.canvas.height,
            backgroundColor: parsed.canvas.backgroundColor
          },
          normalizedExportConfig
        ),
      workflowMeta: {
        ...parsed.workflowMeta,
        sceneTag: getCanvasPreset(parsed.canvas.presetId).scene
      }
    })
  );
}

function loadPersistedDraftDocument() {
  const fallback = createInitialDocument();
  const raw = window.localStorage.getItem(fallback.draftMeta.storageKey);

  if (!raw) {
    return null;
  }

  return normalizeLoadedDocument(JSON.parse(raw) as EditorDocument);
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

function replaceImageLayerSourceInPlace(
  layer: ImageLayer,
  source: string,
  size: { width: number; height: number },
  options?: {
    assetId?: string | null;
    sourceUrl?: string | null;
    sourceDataUrl?: string | null;
    sourceOrigin?: ImageLayer["sourceOrigin"];
  }
): ImageLayer {
  const visibleWidth = layer.crop.width * layer.transform.scaleX;
  const visibleHeight = layer.crop.height * layer.transform.scaleY;

  return {
    ...layer,
    source,
    assetId: options?.assetId ?? layer.assetId,
    sourceUrl: options?.sourceUrl ?? null,
    sourceDataUrl: options?.sourceDataUrl ?? null,
    sourceOrigin: options?.sourceOrigin ?? layer.sourceOrigin,
    originalWidth: size.width,
    originalHeight: size.height,
    crop: createImageCrop(size.width, size.height),
    transform: {
      ...layer.transform,
      x: layer.transform.x,
      y: layer.transform.y,
      scaleX: Number((visibleWidth / size.width).toFixed(6)),
      scaleY: Number((visibleHeight / size.height).toFixed(6))
    }
  };
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
  if (isPendingImageLayer(layer)) {
    throw new Error("请先导入图片后再执行 AI 操作。");
  }

  const image = await loadImageElement(getImageLayerSource(layer));
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
  selectedLayerIds: getDefaultSelectedLayerIds(initialDocument),
  document: initialDocument,
  cropSession: null,
  repairSession: null,
  historyPast: [],
  historyFuture: [],
  syncStatus: hasBackendConfig() ? "idle" : "idle",
  lastSyncedAt: null,
  lastSyncError: null,
  hydrationStatus: "booting",
  pendingServerSave: false,
  hydrateDocumentFromServer: async () => {
    if (!hasBackendConfig()) {
      set({ hydrationStatus: "ready" });
      return;
    }

    const currentDocument = get().document;

    if (isTemporaryDocumentId(currentDocument.id)) {
      set({ hydrationStatus: "ready" });
      return;
    }

    try {
      const remoteDocument = await loadEditorDocument(currentDocument.id);

      if (!remoteDocument) {
        set({ hydrationStatus: "ready" });
        return;
      }

      const normalizedDocument = normalizeLoadedDocument(remoteDocument);

      set({
        document: normalizedDocument,
        selectedLayerIds: getDefaultSelectedLayerIds(normalizedDocument),
        cropSession: null,
        repairSession: null,
        historyPast: [],
        historyFuture: [],
        syncStatus: "saved",
        lastSyncedAt: normalizedDocument.updatedAt,
        lastSyncError: null,
        hydrationStatus: "ready",
        pendingServerSave: false
      });
    } catch (error) {
      set({
        hydrationStatus: "error",
        syncStatus: "error",
        lastSyncError: error instanceof Error ? error.message : "Failed to restore remote draft."
      });
    }
  },
  flushDocumentSave: async (options) => {
    if (!hasBackendConfig()) {
      return false;
    }

    const currentState = get();
    const shouldForce = Boolean(options?.force);
    const syncBlockedByConflict =
      currentState.syncStatus === "error" &&
      currentState.lastSyncError === SERVER_SYNC_CONFLICT_MESSAGE;

    if (syncBlockedByConflict && !shouldForce) {
      return false;
    }

    if (!currentState.pendingServerSave && !shouldForce) {
      return true;
    }

    if (inFlightDocumentSave) {
      queueDocumentSaveAfterCurrent = true;
      return inFlightDocumentSave;
    }

    const documentToSave = cloneDocument(currentState.document);

    set({
      syncStatus: "saving",
      lastSyncError: null,
      pendingServerSave: false
    });

    inFlightDocumentSave = (async () => {
      try {
        const saveResult = await saveEditorDocument(documentToSave);
        const syncedAt = new Date().toISOString();

        set((state) => ({
          document:
            state.document.id === documentToSave.id
              ? {
                  ...state.document,
                  id: saveResult?.id ?? state.document.id,
                  version: state.pendingServerSave
                    ? state.document.version
                    : (saveResult?.version ?? state.document.version)
                }
              : state.document,
          syncStatus: "saved",
          lastSyncedAt: syncedAt,
          lastSyncError: null
        }));

        return true;
      } catch (error) {
        const isConflict =
          error instanceof BackendRequestError &&
          (error.status === 409 || error.status === 412);

        set((state) => ({
          syncStatus: "error",
          lastSyncError: isConflict
            ? SERVER_SYNC_CONFLICT_MESSAGE
            : error instanceof Error
              ? error.message
              : "Failed to sync document.",
          pendingServerSave: true
        }));

        return false;
      } finally {
        inFlightDocumentSave = null;

        if (queueDocumentSaveAfterCurrent) {
          queueDocumentSaveAfterCurrent = false;
          if (get().pendingServerSave) {
            void get().flushDocumentSave();
          }
        }
      }
    })();

    return inFlightDocumentSave;
  },
  setActiveTool: (tool) =>
    set((state) => ({
      activeTool: tool,
      cropSession: tool === "crop" ? state.cropSession : null,
      repairSession: tool === "repair" ? state.repairSession : null
    })),
  createDocumentFromTemplate: (templateId) =>
    set(() => {
      const document = createTemplateDocument(templateId);
      const firstSelectable = document.layers[1]?.id ?? document.layers[0]?.id;

      return {
        activeTool: "select",
        selectedLayerIds: firstSelectable ? [firstSelectable] : [],
        document,
        cropSession: null,
        repairSession: null,
        historyPast: [],
        historyFuture: [],
        syncStatus: "idle",
        lastSyncedAt: null,
        lastSyncError: null,
        hydrationStatus: "ready",
        pendingServerSave: true
      };
    }),
  createBlankDocument: (presetId) =>
    set(() => {
      const document = applyPlatformPresetToDocument(createBlankDocument(), presetId);

      return {
        activeTool: "select",
        selectedLayerIds: getDefaultSelectedLayerIds(document),
        document,
        cropSession: null,
        repairSession: null,
        historyPast: [],
        historyFuture: [],
        syncStatus: "idle",
        lastSyncedAt: null,
        lastSyncError: null,
        hydrationStatus: "ready",
        pendingServerSave: true
      };
    }),
  setPlatformPreset: (presetId) =>
    set((state) =>
      commitDocumentChange(state, applyPlatformPresetToDocument(state.document, presetId))
    ),
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
            safeAreaInset: getDefaultSafeAreaInset(preset.width, preset.height),
            viewport: createDefaultCanvasViewport()
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
          renderRequest:
            state.document.exportConfig.resizeMode === "fixed" &&
            state.document.exportConfig.sizePreset === "group"
              ? {
                  ...state.document.renderRequest,
                  width: preset.width,
                  height: preset.height,
                  background: {
                    ...state.document.renderRequest.background,
                    color: state.document.canvas.backgroundColor
                  }
                }
              : state.document.renderRequest,
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
        },
        renderRequest: {
          ...state.document.renderRequest,
          background: {
            ...state.document.renderRequest.background,
            color: state.document.canvas.backgroundColor
          }
        }
      }),
      pendingServerSave: true
    })),
  setCanvasSafeAreaInset: (inset) =>
    set((state) => {
      const maxInset = Math.floor(
        Math.min(state.document.canvas.width, state.document.canvas.height) / 2
      );
      const safeAreaInset = Number.isFinite(inset) ? clamp(Math.round(inset), 0, maxInset) : 0;

      return {
        document: touchDocument({
          ...state.document,
          canvas: {
            ...state.document.canvas,
            safeAreaInset
          }
        }),
        pendingServerSave: true
      };
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
    const layerId = createLayerId("image");

    set((state) => {
      const nextLayer: EditorLayer = {
        id: layerId,
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
        source: asset.sourceDataUrl,
        assetId: null,
        sourceUrl: null,
        sourceDataUrl: asset.sourceDataUrl,
        sourceOrigin: "local",
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

    try {
      const uploadedAsset = await uploadImageAsset(file);

      if (!uploadedAsset) {
        return;
      }

      set((state) =>
        commitDocumentChange(
          state,
          updateLayers(
            {
              ...state.document,
              assetRegistry: {
                ...state.document.assetRegistry,
                [uploadedAsset.assetId]: uploadedAsset
              }
            },
            (layers) =>
              layers.map((layer) =>
                layer.id === layerId && layer.type === "image"
                  ? {
                      ...layer,
                      assetId: uploadedAsset.assetId,
                      sourceUrl: uploadedAsset.sourceUrl,
                      sourceOrigin: "remote"
                    }
                  : layer
              )
          ),
          [layerId]
        )
      );
    } catch {
      // Keep local editing available even when the backend upload path is unavailable.
    }
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
        businessComponentId: null,
        businessComponentLabel: null,
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
        businessComponentId: null,
        businessComponentLabel: null,
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
  addBusinessComponent: (componentId) =>
    set((state) => {
      const result = insertBusinessComponentLayer(state.document, componentId);

      return commitDocumentChange(state, result.document, [result.layerId], {
        activeTool: "text"
      });
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

      return commitDocumentChange(
        state,
        validateDocument(
          (() => {
            const nextDocument = {
              ...state.document,
              exportConfig: mergedExportConfig,
              updatedAt: new Date().toISOString()
            };

            return {
              ...nextDocument,
              renderRequest: buildRenderRequest(nextDocument)
            };
          })()
        )
      );
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
      },
      pendingServerSave: true
    })),
  markWorkflowApplied: () =>
    set((state) => ({
      document: {
        ...state.document,
        workflowMeta: {
          ...state.document.workflowMeta,
          lastAppliedAt: new Date().toISOString()
        }
      },
      pendingServerSave: true
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
                    downloadUrl: null,
                    fileName: null,
                    providerModel: null,
                    errorMessage: null
                  }
                }
              }
            : entry
        )
      ),
      pendingServerSave: true
    }));

    try {
      const imageDataUrl = await renderImageLayerCropDataUrl(layer);
      const maskDataUrl = await renderRepairMaskDataUrl(layer, state.repairSession.strokes);
      const guideDataUrl = await renderRepairGuideDataUrl(layer, state.repairSession.strokes);
      const maskAnalysis = await analyzeRepairMask(maskDataUrl);
      const prompt = buildRepairPrompt(layer, state.repairSession, maskAnalysis);
      const mode: RepairMode = "guided_repaint";
      const result = await runImageRepairTask({
        documentId: state.document.id,
        documentVersion: state.document.version,
        layerId,
        assetId: layer.assetId,
        crop: layer.crop,
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
                        downloadUrl: result.downloadUrl,
                        fileName: result.fileName,
                        providerModel: result.providerModel,
                        errorMessage: result.errorMessage
                      }
                    }
                  }
                : entry
            )
          ),
          pendingServerSave: true
        }));

        return { success: false, errorMessage: result.errorMessage ?? "局部重绘失败。" };
      }

      const size = await getImageSizeFromSource(result.resultUrl);

      set((current) => {
        const nextDocument = updateLayers(current.document, (layers) =>
          layers.map((entry) =>
            entry.id === layerId && entry.type === "image"
              ? {
                  ...replaceImageLayerSourceInPlace(entry, result.resultUrl!, size, {
                    assetId: null,
                    sourceUrl: result.resultUrl,
                    sourceDataUrl: null,
                    sourceOrigin: "generated"
                  }),
                  aiMeta: {
                    ...entry.aiMeta,
                    lastAiError: null,
                    lastAiSucceededAt: new Date().toISOString(),
                    repairTask: {
                      taskId: result.taskId,
                      status: result.status,
                      resultUrl: result.resultUrl,
                      downloadUrl: result.downloadUrl,
                      fileName: result.fileName,
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
        ),
        pendingServerSave: true
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
      : getImageLayerSource(layer);

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
        ),
        pendingServerSave: true
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
        ),
        pendingServerSave: true
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
      historyFuture: [],
      pendingServerSave: true
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
        ],
        pendingServerSave: true
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
        historyFuture: rest.map(cloneHistoryEntry),
        pendingServerSave: true
      };
    })
}));
