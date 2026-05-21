export const canvasPresets = [
  {
    id: "1:1",
    label: "1:1",
    width: 1080,
    height: 1080,
    scene: "商品方图"
  },
  {
    id: "3:4",
    label: "3:4",
    width: 900,
    height: 1200,
    scene: "商品竖版"
  },
  {
    id: "4:5",
    label: "4:5",
    width: 1080,
    height: 1350,
    scene: "投放主图"
  },
  {
    id: "9:16",
    label: "9:16",
    width: 1080,
    height: 1920,
    scene: "短视频封面"
  },
  {
    id: "custom",
    label: "自定义",
    width: 1200,
    height: 1500,
    scene: "自定义画布"
  }
] as const;

export const layerTypes = ["image", "text", "decoration", "doodle"] as const;
export const textTemplateIds = ["title", "price", "coupon", "highlight", "flash", "new", "hot", "free", "gift", "digital"] as const;
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
export const decorationKinds = ["shape", "sticker"] as const;
export const decorationShapeIds = ["heart", "circle", "rectangle"] as const;
export const decorationStickerIds = ["star", "ribbon", "bear", "strawberry", "sparkle"] as const;
export const editorToolIds = [
  "select",
  "crop",
  "doodle",
  "repair",
  "ai3d",
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
export type DecorationKind = (typeof decorationKinds)[number];
export type DecorationShapeId = (typeof decorationShapeIds)[number];
export type DecorationStickerId = (typeof decorationStickerIds)[number];
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
  intensity: number;
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  blur: number;
  sharpen: number;
  temperature: number;
  hue: number;
};

export type DoodlePoint = {
  x: number;
  y: number;
};

export type RepairStroke = {
  points: DoodlePoint[];
  brushSize: number;
  mode: "paint" | "erase";
};

export type Model3dTaskStatus = "idle" | "pending" | "running" | "succeeded" | "failed";

export type Model3dTaskMeta = {
  taskId: string | null;
  status: Model3dTaskStatus;
  downloadUrl: string | null;
  fileName: string | null;
  providerModel: string | null;
};

export type ImageAiMeta = {
  prompt: string;
  expandPrompt: string;
  repairPrompt: string;
  lastAiAction: "seed3d" | "outpaint" | "repair" | null;
  lastAiRequestedAt: string | null;
  lastAiSucceededAt: string | null;
  lastAiError: string | null;
  model3dTask: Model3dTaskMeta;
  repairTask: {
    taskId: string | null;
    status: "idle" | "pending" | "running" | "succeeded" | "failed";
    resultUrl: string | null;
    providerModel: string | null;
    errorMessage: string | null;
  };
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
  decorationKind: DecorationKind;
  shape: DecorationShapeId;
  sticker: DecorationStickerId;
  width: number;
  height: number;
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
  },
  {
    id: "flash",
    label: "秒杀闪购",
    content: "限时秒杀",
    name: "秒杀闪购",
    style: {
      fontSize: 64,
      fontWeight: 800,
      fill: "#ffffff",
      stroke: "#d00f00",
      strokeWidth: 5,
      shadow: "0 16px 32px rgba(208, 15, 0, 0.3)",
      backgroundColor: "#ff4d4d",
      gradient: ["#ff8080", "#ff0000"]
    }
  },
  {
    id: "new",
    label: "新品推荐",
    content: "新品上市",
    name: "新品推荐",
    style: {
      fontSize: 60,
      fontWeight: 800,
      fill: "#ffffff",
      stroke: "#1a5f4a",
      strokeWidth: 4,
      shadow: "0 14px 28px rgba(26, 95, 74, 0.2)",
      backgroundColor: "#00c875",
      gradient: ["#50ffb3", "#00c875"]
    }
  },
  {
    id: "hot",
    label: "热销爆款",
    content: "热销爆款",
    name: "热销爆款",
    style: {
      fontSize: 66,
      fontWeight: 800,
      fill: "#fff5e6",
      stroke: "#8b4500",
      strokeWidth: 6,
      shadow: "0 18px 30px rgba(139, 69, 0, 0.25)",
      backgroundColor: "#ff9d4d",
      gradient: ["#ffcc80", "#ff6600"]
    }
  },
  {
    id: "free",
    label: "包邮特惠",
    content: "全场包邮",
    name: "包邮特惠",
    style: {
      fontSize: 56,
      fontWeight: 700,
      fill: "#ffffff",
      stroke: "#2d5f8b",
      strokeWidth: 4,
      shadow: "0 14px 26px rgba(45, 95, 139, 0.2)",
      backgroundColor: "#5dade2",
      gradient: ["#85c1e9", "#3498db"]
    }
  },
  {
    id: "gift",
    label: "赠品专属",
    content: "满赠好礼",
    name: "赠品专属",
    style: {
      fontSize: 52,
      fontWeight: 700,
      fill: "#fff0f5",
      stroke: "#8b1455",
      strokeWidth: 4,
      shadow: "0 14px 26px rgba(139, 20, 85, 0.2)",
      backgroundColor: "#ff85a2",
      gradient: ["#ffb6c1", "#ff69b4"]
    }
  },
  {
    id: "digital",
    label: "数码科技",
    content: "科技生活",
    name: "数码科技",
    style: {
      fontSize: 58,
      fontWeight: 700,
      fill: "#e6f4ff",
      stroke: "#004080",
      strokeWidth: 4,
      shadow: "0 14px 26px rgba(0, 64, 128, 0.2)",
      backgroundColor: "#4da6ff",
      gradient: ["#80bfff", "#0066cc"]
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
      intensity: 76,
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
      intensity: 82,
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
      intensity: 74,
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
      intensity: 64,
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
      intensity: 72,
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
      intensity: 78,
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
      intensity: 70,
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
      intensity: 84,
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
      intensity: 100,
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
      intensity: 68,
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
      intensity: 0,
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

export function getDecorationDefaultSize(
  decorationKind: DecorationKind,
  shape: DecorationShapeId
) {
  if (decorationKind === "sticker") {
    return {
      width: 160,
      height: 160
    };
  }

  if (shape === "circle") {
    return {
      width: 160,
      height: 160
    };
  }

  if (shape === "heart") {
    return {
      width: 180,
      height: 160
    };
  }

  return {
    width: 220,
    height: 140
  };
}

export function createDefaultImageFilters(): ImageFilters {
  return {
    intensity: 100,
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

export function createDefaultImageAiMeta(): ImageAiMeta {
  return {
    prompt: "生成高质量3D模型。",
    expandPrompt: "在延展画面的同时保持主体位置、背景氛围和整体光线一致。",
    repairPrompt: "仅移除高亮标记的水印。保持所有未高亮内容不变，并保留产品边缘、主体细节、光线和色调。",
    lastAiAction: null,
    lastAiRequestedAt: null,
    lastAiSucceededAt: null,
    lastAiError: null,
    model3dTask: {
      taskId: null,
      status: "idle",
      downloadUrl: null,
      fileName: null,
      providerModel: null
    },
    repairTask: {
      taskId: null,
      status: "idle",
      resultUrl: null,
      providerModel: null,
      errorMessage: null
    }
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
    name: "AIGC 修图工作台",
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
        zoom: 0.5,
        panX: 0,
        panY: 0
      }
    },
    layers: [
      {
        id: createLayerId("image"),
        name: "AI 初稿",
        type: "image",
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
        aiMeta: createDefaultImageAiMeta()
      },
      {
        id: createLayerId("text"),
        name: "标题大字",
        type: "text",
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
        content: "爆款主标题",
        textTemplateId: "title",
        style: createDefaultTextStyle()
      },
      {
        id: createLayerId("decoration"),
        name: "价格贴片",
        type: "decoration",
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
        decorationKind: "shape",
        shape: "heart",
        sticker: "sparkle",
        width: 180,
        height: 160,
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
