export const canvasPresets = [
  {
    id: "1:1",
    label: "1:1",
    width: 1080,
    height: 1080,
    scene: "\u5546\u54c1\u65b9\u56fe"
  },
  {
    id: "3:4",
    label: "3:4",
    width: 900,
    height: 1200,
    scene: "\u5546\u54c1\u7ad6\u7248"
  },
  {
    id: "4:5",
    label: "4:5",
    width: 1080,
    height: 1350,
    scene: "\u6295\u653e\u4e3b\u56fe"
  },
  {
    id: "9:16",
    label: "9:16",
    width: 1080,
    height: 1920,
    scene: "\u77ed\u89c6\u9891\u5c01\u9762"
  },
  {
    id: "custom",
    label: "\u81ea\u5b9a\u4e49",
    width: 1200,
    height: 1500,
    scene: "\u81ea\u5b9a\u4e49\u753b\u5e03"
  }
] as const;

export const layerTypes = ["image", "text", "decoration", "doodle"] as const;
export const textTemplateIds = ["title", "price", "coupon", "highlight"] as const;
export const imagePresetFilterIds = [
  "beauty",
  "food",
  "fashion",
  "home",
  "fresh",
  "warm",
  "cool",
  "film",
  "mono",
  "clear"
] as const;
export const enhanceProfileIds = ["auto"] as const;
export const canvasBackgroundModes = ["grid", "solid", "dots"] as const;
export const editorToolIds = [
  "select",
  "crop",
  "doodle",
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
export type CanvasBackgroundMode = (typeof canvasBackgroundModes)[number];
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
  vibrance: number;
  blur: number;
  sharpen: number;
  temperature: number;
  hue: number;
};

export type MaskPoint = {
  x: number;
  y: number;
};

export type DoodlePoint = {
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

export type DoodleLayer = LayerBase & {
  type: "doodle";
  points: DoodlePoint[];
  stroke: string;
  strokeWidth: number;
};

export type EditorLayer = ImageLayer | TextLayer | DecorationLayer | DoodleLayer;

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
  displayBackground: {
    mode: CanvasBackgroundMode;
    color: string;
  };
  safeAreaInset: number;
  viewport: CanvasViewport;
};

export type ExportQualityPreset = "standard" | "high";
export type ExportResizeMode = "fixed" | "scale";
export type ExportSizePreset = "group" | "free" | "1inch" | "2inch";

export type ExportConfig = {
  format: "png" | "jpeg";
  quality: number;
  scale: number;
  qualityPreset: ExportQualityPreset;
  resizeMode: ExportResizeMode;
  sizePreset: ExportSizePreset;
  width: number;
  height: number;
  scalePercent: number;
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
  image: "图片图层",
  text: "文字图层",
  decoration: "装饰图层",
  doodle: "涂鸦图层"
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
    label: "标题大字",
    content: "爆款主标题",
    name: "标题大字",
    style: {
      fontSize: 88,
      fontWeight: 800,
      fill: "#fff5ec",
      stroke: "#4a2012",
      strokeWidth: 8,
      shadow: "0 20px 36px rgba(74, 32, 18, 0.18)",
      backgroundColor: "#ff9d4d",
      gradient: ["#ffd36f", "#ff7e45"]
    }
  },
  {
    id: "price",
    label: "价格贴片",
    content: "到手价 59",
    name: "价格贴片",
    style: {
      fontSize: 72,
      fontWeight: 800,
      fill: "#fffaf4",
      stroke: "#0e5f4a",
      strokeWidth: 6,
      shadow: "0 16px 28px rgba(14, 95, 74, 0.16)",
      backgroundColor: "#6ef3cf",
      gradient: ["#a5ffdc", "#4fd7ba"]
    }
  },
  {
    id: "coupon",
    label: "优惠券文案",
    content: "领券立减 30",
    name: "优惠券文案",
    style: {
      fontSize: 54,
      fontWeight: 700,
      fill: "#fffaf7",
      stroke: "#7f2641",
      strokeWidth: 4,
      shadow: "0 14px 24px rgba(127, 38, 65, 0.16)",
      backgroundColor: "#ff90ac",
      gradient: ["#ffcbda", "#ff8daa"]
    }
  },
  {
    id: "highlight",
    label: "重点高亮条",
    content: "限时加赠 今日生效",
    name: "重点高亮条",
    style: {
      fontSize: 46,
      fontWeight: 700,
      fill: "#14352d",
      stroke: "#f3ffcc",
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
    label: "通透美妆",
    description: "参考主流人像精修风格，提亮肤色与通透感，压低黄感，适合美妆和人物商品图。",
    filters: {
      brightness: 0.12,
      contrast: 0.1,
      saturation: 0.06,
      vibrance: 0.18,
      blur: 0,
      sharpen: 0.16,
      temperature: -0.03,
      hue: -0.03
    }
  },
  {
    id: "food",
    label: "食欲增强",
    description: "参考常见美食电商图，强化红润与新鲜感，保留食材层次，避免整张图发黄。",
    filters: {
      brightness: 0.05,
      contrast: 0.16,
      saturation: 0.12,
      vibrance: 0.24,
      blur: 0,
      sharpen: 0.14,
      temperature: 0.05,
      hue: -0.015
    }
  },
  {
    id: "fashion",
    label: "冷白服饰",
    description: "参考主流服饰详情页色调，偏冷白与利落对比，凸显面料纹理和版型。",
    filters: {
      brightness: 0.03,
      contrast: 0.18,
      saturation: -0.02,
      vibrance: 0.12,
      blur: 0,
      sharpen: 0.26,
      temperature: -0.1,
      hue: -0.025
    }
  },
  {
    id: "home",
    label: "奶油家居",
    description: "参考家居生活方式图片，整体更柔和中性，保留暖感但不过分偏黄。",
    filters: {
      brightness: 0.08,
      contrast: 0.04,
      saturation: 0.02,
      vibrance: 0.08,
      blur: 0.02,
      sharpen: 0.05,
      temperature: 0.035,
      hue: -0.01
    }
  },
  {
    id: "fresh",
    label: "清新氧气",
    description: "参考日系清透风格，整体更轻盈偏冷，适合护肤、花植和轻生活场景。",
    filters: {
      brightness: 0.11,
      contrast: 0.04,
      saturation: 0.04,
      vibrance: 0.16,
      blur: 0,
      sharpen: 0.1,
      temperature: -0.08,
      hue: 0.02
    }
  },
  {
    id: "warm",
    label: "日落暖调",
    description: "参考社媒常见暖调滤镜，增加氛围感与肤色亲和力，但控制成更克制的金色暖调。",
    filters: {
      brightness: 0.06,
      contrast: 0.1,
      saturation: 0.08,
      vibrance: 0.14,
      blur: 0,
      sharpen: 0.1,
      temperature: 0.09,
      hue: -0.02
    }
  },
  {
    id: "cool",
    label: "海盐冷调",
    description: "参考数码与极简商品图，降低暖黄感，强调干净、冷静和清晰边缘。",
    filters: {
      brightness: 0.02,
      contrast: 0.14,
      saturation: -0.04,
      vibrance: 0.08,
      blur: 0,
      sharpen: 0.18,
      temperature: -0.14,
      hue: 0.03
    }
  },
  {
    id: "film",
    label: "胶片复古",
    description: "参考常见复古胶片色，降低纯净度与饱和度，保留一点暖灰质感。",
    filters: {
      brightness: -0.02,
      contrast: 0.14,
      saturation: -0.14,
      vibrance: -0.06,
      blur: 0.01,
      sharpen: 0.12,
      temperature: 0.03,
      hue: -0.01
    }
  },
  {
    id: "mono",
    label: "经典黑白",
    description: "参考经典黑白摄影，强化明暗层次与结构，适合强调轮廓和质感。",
    filters: {
      brightness: 0.04,
      contrast: 0.22,
      saturation: -1,
      vibrance: 0,
      blur: 0,
      sharpen: 0.2,
      temperature: 0,
      hue: 0
    }
  },
  {
    id: "clear",
    label: "高清通透",
    description: "参考平台主图增强风格，提升清晰感和反差，适合大多数商品主图。",
    filters: {
      brightness: 0.05,
      contrast: 0.18,
      saturation: 0.04,
      vibrance: 0.12,
      blur: 0,
      sharpen: 0.28,
      temperature: -0.04,
      hue: 0
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
    label: "商品增强",
    description: "自动补足亮度、层次和清晰度，作为大多数商品图的安全增强方案。",
    filters: {
      brightness: 0.07,
      contrast: 0.14,
      saturation: 0.04,
      vibrance: 0.14,
      blur: 0,
      sharpen: 0.2,
      temperature: 0.01,
      hue: 0
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

export function createDefaultDoodleStyle() {
  return {
    stroke: "#cd5c2d",
    strokeWidth: 14
  };
}

export function createDefaultImageFilters(): ImageFilters {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    vibrance: 0,
    blur: 0,
    sharpen: 0,
    temperature: 0,
    hue: 0
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
    prompt: "\u53bb\u6389\u7455\u75b5\u548c\u5e72\u6270\u5143\u7d20\uff0c\u4fdd\u6301\u5546\u54c1\u4e3b\u4f53\u3001\u5149\u5f71\u548c\u753b\u9762\u98ce\u683c\u81ea\u7136\u4e00\u81f4\u3002",
    expandPrompt: "\u5728\u5ef6\u5c55\u753b\u9762\u7684\u540c\u65f6\u4fdd\u6301\u4e3b\u4f53\u4f4d\u7f6e\u3001\u80cc\u666f\u6c1b\u56f4\u548c\u6574\u4f53\u5149\u7ebf\u4e00\u81f4\u3002",
    lastAiAction: null,
    lastAiRequestedAt: null,
    lastAiSucceededAt: null,
    lastAiError: null
  };
}

export function createDefaultExportConfig(
  canvas: Pick<CanvasModel, "width" | "height"> = getCanvasPreset("4:5")
): ExportConfig {
  return {
    format: "png",
    quality: 0.92,
    scale: 1,
    qualityPreset: "high",
    resizeMode: "fixed",
    sizePreset: "group",
    width: canvas.width,
    height: canvas.height,
    scalePercent: 100
  };
}

export function getDefaultSafeAreaInset(width: number, height: number) {
  const shortEdge = Math.min(width, height);
  return Math.round(Math.max(36, Math.min(shortEdge * 0.045, 64)));
}

export function createInitialDocument(): EditorDocument {
  const preset = getCanvasPreset("4:5");

  return {
    id: "doc-editor-mvp",
    name: "AIGC \u4fee\u56fe\u5de5\u4f5c\u53f0",
    canvas: {
      presetId: preset.id,
      width: preset.width,
      height: preset.height,
      backgroundColor: "#fbf6ef",
      displayBackground: {
        mode: "grid",
        color: "#fbf6ef"
      },
      safeAreaInset: getDefaultSafeAreaInset(preset.width, preset.height),
      viewport: {
        zoom: 0.72,
        panX: 0,
        panY: 0
      }
    },
    layers: [
      {
        name: "AI \u521d\u7a3f",
        type: "image",
        name: "AI 鍒濈",
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
        name: "\u6807\u9898\u5927\u5b57",
        type: "text",
        name: "鏍囬澶у瓧",
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
        content: "\u7206\u6b3e\u4e3b\u6807\u9898",
        textTemplateId: "title",
        style: createDefaultTextStyle()
      },
      {
        name: "\u4ef7\u683c\u8d34\u7247",
        type: "decoration",
        name: "浠锋牸璐寸墖",
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
    exportConfig: createDefaultExportConfig(preset),
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
