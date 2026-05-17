export const canvasPresets = [
  {
    id: "1:1",
    label: "1:1",
    width: 1080,
    height: 1080,
    scene: "商品主图"
  },
  {
    id: "3:4",
    label: "3:4",
    width: 900,
    height: 1200,
    scene: "信息流海报"
  },
  {
    id: "4:5",
    label: "4:5",
    width: 1080,
    height: 1350,
    scene: "商城推荐图"
  },
  {
    id: "9:16",
    label: "9:16",
    width: 1080,
    height: 1920,
    scene: "竖版封面"
  },
  {
    id: "custom",
    label: "自定义",
    width: 1200,
    height: 1500,
    scene: "自定义投放位"
  }
] as const;

export const layerTypes = ["image", "text", "decoration"] as const;
export const textTemplateIds = ["title", "price", "coupon", "highlight"] as const;
export const imagePresetFilterIds = ["beauty", "food", "fashion", "home"] as const;
export const enhanceProfileIds = ["auto"] as const;
export const editorToolIds = [
  "select",
  "hand",
  "crop",
  "brush",
  "eraser",
  "repair",
  "text",
  "filter",
  "shape"
] as const;

export type CanvasPresetId = (typeof canvasPresets)[number]["id"];
export type LayerType = (typeof layerTypes)[number];
export type TextTemplateId = (typeof textTemplateIds)[number];
export type ImagePresetFilterId = (typeof imagePresetFilterIds)[number];
export type EnhanceProfileId = (typeof enhanceProfileIds)[number];
export type EditorTool = (typeof editorToolIds)[number];

export type LayerTransform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
};

export type LayerBase = {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
  transform: LayerTransform;
};

export type ImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageFilters = {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  sharpen: number;
  temperature: number;
};

export type MaskPoint = {
  x: number;
  y: number;
};

export type MaskStroke = {
  id: string;
  mode: "paint" | "erase";
  size: number;
  points: MaskPoint[];
};

export type ImageMask = {
  showPreview: boolean;
  brushSize: number;
  strokes: MaskStroke[];
  activeStrokeId: string | null;
};

export type ImageAiMeta = {
  prompt: string;
  expandPrompt: string;
  lastAiAction: "inpaint" | "outpaint" | null;
  lastAiRequestedAt: string | null;
  lastAiSucceededAt: string | null;
  lastAiError: string | null;
};

export type ImageLayer = LayerBase & {
  type: "image";
  source: string;
  originalWidth: number;
  originalHeight: number;
  crop: ImageCrop;
  presetFilterId: ImagePresetFilterId | null;
  enhanceProfileId: EnhanceProfileId | null;
  filters: ImageFilters;
  mask: ImageMask;
  aiMeta: ImageAiMeta;
};

export type TextLayer = LayerBase & {
  type: "text";
  content: string;
  textTemplateId: TextTemplateId | null;
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    shadow: string;
    backgroundColor: string;
    gradient: string[];
  };
};

export type DecorationLayer = LayerBase & {
  type: "decoration";
  shape: "ribbon" | "badge" | "highlight";
  fill: string;
};

export type EditorLayer = ImageLayer | TextLayer | DecorationLayer;

export type CanvasViewport = {
  zoom: number;
  panX: number;
  panY: number;
};

export type CanvasModel = {
  presetId: CanvasPresetId;
  width: number;
  height: number;
  backgroundColor: string;
  safeAreaInset: number;
  viewport: CanvasViewport;
};

export type ExportConfig = {
  format: "png" | "jpeg";
  quality: number;
  scale: number;
};

export type DraftMeta = {
  enabled: boolean;
  storageKey: string;
  lastSavedAt: string | null;
};

export type WorkflowMeta = {
  sceneTag: string;
  version: number;
  lastExportedAt: string | null;
  lastAppliedAt: string | null;
  returnMode: "postmessage";
  targetOrigin: string;
  sessionId: string | null;
};

export type EditorDocument = {
  id: string;
  name: string;
  canvas: CanvasModel;
  layers: EditorLayer[];
  exportConfig: ExportConfig;
  draftMeta: DraftMeta;
  workflowMeta: WorkflowMeta;
  updatedAt: string;
};

export const layerTypeLabels: Record<LayerType, string> = {
  image: "图片层",
  text: "花字层",
  decoration: "装饰层"
};

export const textTemplatePresets: Array<{
  id: TextTemplateId;
  label: string;
  content: string;
  name: string;
  style: Partial<TextLayer["style"]>;
}> = [
  {
    id: "title",
    label: "主标题花字",
    content: "爆款卖点一眼看见",
    name: "主标题花字",
    style: {
      fontSize: 88,
      fontWeight: 800,
      fill: "#13201a",
      stroke: "#fff7ef",
      strokeWidth: 8,
      backgroundColor: "#ffd073",
      gradient: ["#ff8242", "#ffc247"]
    }
  },
  {
    id: "price",
    label: "价格角标",
    content: "到手价 59",
    name: "价格角标",
    style: {
      fontSize: 72,
      fontWeight: 800,
      fill: "#fffaf3",
      stroke: "#b53720",
      strokeWidth: 4,
      backgroundColor: "#cf4125",
      gradient: ["#ff8750", "#ff5c3d"]
    }
  },
  {
    id: "coupon",
    label: "优惠券标签",
    content: "领券立减 30",
    name: "优惠券标签",
    style: {
      fontSize: 54,
      fontWeight: 700,
      fill: "#fff9ef",
      stroke: "#8d2f1f",
      strokeWidth: 3,
      backgroundColor: "#eb6541",
      gradient: ["#ff8f5f", "#ffcb63"]
    }
  },
  {
    id: "highlight",
    label: "卖点高亮条",
    content: "限时加赠 热卖推荐",
    name: "卖点高亮条",
    style: {
      fontSize: 46,
      fontWeight: 700,
      fill: "#14312a",
      stroke: "#fef6ea",
      strokeWidth: 2,
      backgroundColor: "#a7f0cb",
      gradient: ["#d9ff8c", "#86e1b4"]
    }
  }
];

export const imageFilterPresets: Array<{
  id: ImagePresetFilterId;
  label: string;
  description: string;
  filters: ImageFilters;
}> = [
  {
    id: "beauty",
    label: "美妆通透",
    description: "提亮肤感和产品高光，适合美妆护肤主图。",
    filters: {
      brightness: 0.08,
      contrast: 0.12,
      saturation: 0.14,
      blur: 0,
      sharpen: 0.18,
      temperature: 0.06
    }
  },
  {
    id: "food",
    label: "食品诱人",
    description: "加强食物层次和暖色食欲感，适合零食与餐饮。",
    filters: {
      brightness: 0.06,
      contrast: 0.18,
      saturation: 0.2,
      blur: 0,
      sharpen: 0.12,
      temperature: 0.1
    }
  },
  {
    id: "fashion",
    label: "服饰质感",
    description: "增强材质纹理与边缘锐度，适合服饰上新图。",
    filters: {
      brightness: 0.02,
      contrast: 0.16,
      saturation: 0.08,
      blur: 0,
      sharpen: 0.24,
      temperature: -0.02
    }
  },
  {
    id: "home",
    label: "家居温润",
    description: "保持空间柔和感和清洁度，适合家居生活方式图。",
    filters: {
      brightness: 0.05,
      contrast: 0.08,
      saturation: 0.06,
      blur: 0.02,
      sharpen: 0.08,
      temperature: 0.08
    }
  }
];

export const enhanceProfiles: Array<{
  id: EnhanceProfileId;
  label: string;
  description: string;
  filters: ImageFilters;
}> = [
  {
    id: "auto",
    label: "一键增强",
    description: "自动提升主体清晰度、对比度和投放观感。",
    filters: {
      brightness: 0.07,
      contrast: 0.14,
      saturation: 0.1,
      blur: 0,
      sharpen: 0.2,
      temperature: 0.04
    }
  }
];

export function getCanvasPreset(presetId: CanvasPresetId) {
  return canvasPresets.find((preset) => preset.id === presetId) ?? canvasPresets[2];
}

export function getTextTemplatePreset(templateId: TextTemplateId) {
  return (
    textTemplatePresets.find((template) => template.id === templateId) ??
    textTemplatePresets[0]
  );
}

export function getImageFilterPreset(presetId: ImagePresetFilterId) {
  return imageFilterPresets.find((preset) => preset.id === presetId) ?? imageFilterPresets[0];
}

export function getEnhanceProfile(profileId: EnhanceProfileId) {
  return enhanceProfiles.find((profile) => profile.id === profileId) ?? enhanceProfiles[0];
}

export function createLayerId(prefix: LayerType) {
  return `layer-${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createStrokeId() {
  return `stroke-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeLayerOrder<T extends EditorLayer>(layers: T[]) {
  return [...layers]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((layer, index) => ({
      ...layer,
      zIndex: index
    }));
}

export function createDefaultTransform(): LayerTransform {
  return {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    flipX: false,
    flipY: false
  };
}

export function createDefaultTextStyle(): TextLayer["style"] {
  return {
    fontFamily: "Avenir Next",
    fontSize: 72,
    fontWeight: 700,
    fill: "#1c2520",
    stroke: "#fdf7ef",
    strokeWidth: 6,
    shadow: "0 18px 32px rgba(28, 37, 32, 0.16)",
    backgroundColor: "#f7c56a",
    gradient: ["#ff7c3f", "#f2be3f"]
  };
}

export function createDefaultImageFilters(): ImageFilters {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    sharpen: 0,
    temperature: 0
  };
}

export function createImageCrop(width: number, height: number): ImageCrop {
  return {
    x: 0,
    y: 0,
    width,
    height
  };
}

export function createDefaultImageMask(): ImageMask {
  return {
    showPreview: true,
    brushSize: 36,
    strokes: [],
    activeStrokeId: null
  };
}

export function createDefaultImageAiMeta(): ImageAiMeta {
  return {
    prompt: "保留主体和商品信息，修复蒙版区域中的瑕疵或杂物，让画面更干净适合电商投放。",
    expandPrompt: "向外自然延展背景，保持主体、光感和风格一致，适配新的投放比例。",
    lastAiAction: null,
    lastAiRequestedAt: null,
    lastAiSucceededAt: null,
    lastAiError: null
  };
}

export function createInitialDocument(): EditorDocument {
  const preset = getCanvasPreset("4:5");

  return {
    id: "doc-editor-mvp",
    name: "AIGC 带货图精修",
    canvas: {
      presetId: preset.id,
      width: preset.width,
      height: preset.height,
      backgroundColor: "#fbf6ef",
      safeAreaInset: 72,
      viewport: {
        zoom: 0.72,
        panX: 0,
        panY: 0
      }
    },
    layers: [
      {
        id: "layer-image-hero",
        type: "image",
        name: "AI 初稿",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 0,
        transform: createDefaultTransform(),
        source: "pending-upload",
        originalWidth: 960,
        originalHeight: 960,
        crop: createImageCrop(960, 960),
        presetFilterId: null,
        enhanceProfileId: null,
        filters: createDefaultImageFilters(),
        mask: createDefaultImageMask(),
        aiMeta: createDefaultImageAiMeta()
      },
      {
        id: "layer-text-title",
        type: "text",
        name: "主标题花字",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 1,
        transform: {
          x: 110,
          y: 180,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          flipX: false,
          flipY: false
        },
        content: "新品卖点一眼看见",
        textTemplateId: "title",
        style: createDefaultTextStyle()
      },
      {
        id: "layer-decoration-badge",
        type: "decoration",
        name: "价格角标",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 2,
        transform: {
          x: 820,
          y: 120,
          scaleX: 1,
          scaleY: 1,
          rotation: -8,
          flipX: false,
          flipY: false
        },
        shape: "badge",
        fill: "#cf5b2d"
      }
    ],
    exportConfig: {
      format: "png",
      quality: 0.92,
      scale: 1
    },
    draftMeta: {
      enabled: true,
      storageKey: "web-ps/editor-draft",
      lastSavedAt: null
    },
    workflowMeta: {
      sceneTag: preset.scene,
      version: 1,
      lastExportedAt: null,
      lastAppliedAt: null,
      returnMode: "postmessage",
      targetOrigin: "*",
      sessionId: null
    },
    updatedAt: new Date().toISOString()
  };
}
