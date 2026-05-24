import {
  createDefaultExportConfig,
  createDefaultAssetRegistry,
  createDefaultRenderRequest,
  createDefaultImageAiMeta,
  createDefaultImageFilters,
  createDefaultTemplateMeta,
  createDefaultTextStyle,
  createImageCrop,
  createLayerId,
  createDefaultValidationState,
  createDefaultTransform,
  getCanvasPreset,
  type CanvasPresetId,
  type DecorationLayer,
  type EditorDocument,
  type EditorLayer,
  type TextLayer,
  type ValidationState
} from "./document";

export const platformPresetIds = [
  "douyin-product",
  "douyin-live-cover",
  "xiaohongshu-cover",
  "taobao-main",
  "wechat-share"
] as const;

export type PlatformPresetId = (typeof platformPresetIds)[number];

export type PlatformPreset = {
  id: PlatformPresetId;
  label: string;
  canvasPresetId: CanvasPresetId;
  safeAreaInset: number;
  recommendedFormat: "png" | "jpeg";
  fileNamePattern: string;
  copyRegionHint: string;
  sceneTag: string;
};

export const businessComponentPresetIds = [
  "headline",
  "price-tag",
  "coupon-badge",
  "flash-sale",
  "new-tag",
  "free-shipping",
  "gift-bonus",
  "selling-points"
] as const;

export type BusinessComponentPresetId = (typeof businessComponentPresetIds)[number];

export type BusinessComponentPreset = {
  id: BusinessComponentPresetId;
  label: string;
  description: string;
  kind: "text" | "decoration";
  templateTextId?: string;
  content?: string;
};

export const templateDefinitionIds = [
  "product-main-hero",
  "product-main-price",
  "product-main-compare",
  "selling-cover-impact",
  "selling-cover-host",
  "promo-banner-convert",
  "live-warmup-reminder",
  "rednote-checklist"
] as const;

export type TemplateDefinitionId = (typeof templateDefinitionIds)[number];

export const templateLayoutVariantIds = [
  "hero-left",
  "hero-center",
  "split-info",
  "title-stack",
  "host-focus",
  "coupon-board",
  "countdown-bottom",
  "checklist-card"
] as const;

export type TemplateLayoutVariantId = (typeof templateLayoutVariantIds)[number];

export const templateSceneGroupIds = ["main-image", "promo", "live", "content-cover"] as const;

export type TemplateSceneGroupId = (typeof templateSceneGroupIds)[number];

export type TemplateDefinition = {
  id: TemplateDefinitionId;
  label: string;
  sceneType: string;
  sceneGroup: TemplateSceneGroupId;
  sceneGroupLabel: string;
  platformPresetId: PlatformPresetId;
  previewImage: string;
  layoutVariant: TemplateLayoutVariantId;
  layoutVariantLabel: string;
  usageTip: string;
  description: string;
  componentIds: BusinessComponentPresetId[];
  aiSlots: string[];
};

type RelativeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TemplateTextOverrides = Partial<Pick<TextLayer["style"], "fontSize" | "strokeWidth" | "backgroundColor" | "gradient" | "fill" | "stroke">>;

type ComponentLayout = RelativeRect & {
  content?: string;
  style?: TemplateTextOverrides;
};

type TemplateLayout = {
  canvasBackground: string;
  displayColor: string;
  image: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  };
  components: Partial<Record<BusinessComponentPresetId, ComponentLayout>>;
};

export const platformPresets: PlatformPreset[] = [
  {
    id: "douyin-product",
    label: "抖音商品图",
    canvasPresetId: "4:5",
    safeAreaInset: 54,
    recommendedFormat: "png",
    fileNamePattern: "douyin-product-{template}-{version}",
    copyRegionHint: "标题和价格尽量靠近中上区域，底部留出主图承载空间。",
    sceneTag: "抖音商品投放"
  },
  {
    id: "douyin-live-cover",
    label: "抖音直播封面",
    canvasPresetId: "9:16",
    safeAreaInset: 64,
    recommendedFormat: "png",
    fileNamePattern: "douyin-live-{template}-{version}",
    copyRegionHint: "标题靠上，底部保留直播时间、福利和主播信息区域。",
    sceneTag: "抖音直播预热"
  },
  {
    id: "xiaohongshu-cover",
    label: "小红书封面",
    canvasPresetId: "3:4",
    safeAreaInset: 48,
    recommendedFormat: "png",
    fileNamePattern: "rednote-cover-{template}-{version}",
    copyRegionHint: "封面文字控制在 2 到 3 行，避免遮挡主体并保持内容感。",
    sceneTag: "小红书种草封面"
  },
  {
    id: "taobao-main",
    label: "淘系主图",
    canvasPresetId: "1:1",
    safeAreaInset: 42,
    recommendedFormat: "jpeg",
    fileNamePattern: "taobao-main-{template}-{version}",
    copyRegionHint: "主图优先突出商品主体，价格和角标尽量贴边但不要压住主体。",
    sceneTag: "淘系商品主图"
  },
  {
    id: "wechat-share",
    label: "微信分享图",
    canvasPresetId: "4:5",
    safeAreaInset: 52,
    recommendedFormat: "png",
    fileNamePattern: "wechat-share-{template}-{version}",
    copyRegionHint: "适合活动传播，券后价与利益点建议放在中下部形成信息闭环。",
    sceneTag: "社群活动分享"
  }
];

export const businessComponentPresets: BusinessComponentPreset[] = [
  {
    id: "headline",
    label: "主标题",
    description: "用于承载核心卖点和主视觉标题。",
    kind: "text",
    templateTextId: "title"
  },
  {
    id: "price-tag",
    label: "价格标签",
    description: "用于突出到手价、折扣价和成交锚点。",
    kind: "text",
    templateTextId: "price"
  },
  {
    id: "coupon-badge",
    label: "优惠券角标",
    description: "用于承载满减、券后价和活动利益点。",
    kind: "text",
    templateTextId: "coupon"
  },
  {
    id: "flash-sale",
    label: "限时闪购",
    description: "用于营造抢购节奏和限时活动氛围。",
    kind: "text",
    templateTextId: "flash"
  },
  {
    id: "new-tag",
    label: "新品标签",
    description: "用于直播预热和新品推荐场景。",
    kind: "text",
    templateTextId: "new"
  },
  {
    id: "free-shipping",
    label: "包邮权益",
    description: "用于突出包邮、赠运费险等履约权益。",
    kind: "text",
    templateTextId: "free"
  },
  {
    id: "gift-bonus",
    label: "赠品权益",
    description: "用于突出赠品、套餐和加赠信息。",
    kind: "text",
    templateTextId: "gift"
  },
  {
    id: "selling-points",
    label: "卖点清单",
    description: "用于承载三条左右的重点卖点或参数清单。",
    kind: "text",
    content: "• 核心卖点一\n• 核心卖点二\n• 核心卖点三"
  }
];

export const templateDefinitions: TemplateDefinition[] = [
  {
    id: "product-main-hero",
    label: "商品主图·大主体卖点款",
    sceneType: "商品主图",
    sceneGroup: "main-image",
    sceneGroupLabel: "主图模板",
    platformPresetId: "taobao-main",
    previewImage: "/templates/previews/product-main-hero.svg",
    layoutVariant: "hero-center",
    layoutVariantLabel: "大主体居中",
    usageTip: "适合标准电商主图，先放大主体，再补一圈短卖点和价格提示。",
    description: "主体占据画面核心区域，标题、价格和卖点围绕主体形成高聚焦主图。",
    componentIds: ["headline", "price-tag", "coupon-badge", "selling-points"],
    aiSlots: ["商品主体大图", "核心卖点摘要"]
  },
  {
    id: "product-main-price",
    label: "商品主图·价格成交款",
    sceneType: "商品主图",
    sceneGroup: "main-image",
    sceneGroupLabel: "主图模板",
    platformPresetId: "douyin-product",
    previewImage: "/templates/previews/product-main-price.svg",
    layoutVariant: "hero-left",
    layoutVariantLabel: "左主体强价格",
    usageTip: "适合低价、秒杀和转化型素材，让价格和活动节奏先抓住视线。",
    description: "主体偏左，右侧集中承接价格、优惠券和限时信息，适合成交导向主图。",
    componentIds: ["headline", "price-tag", "flash-sale", "coupon-badge"],
    aiSlots: ["商品主体图", "价格与优惠信息"]
  },
  {
    id: "product-main-compare",
    label: "商品主图·对比清单款",
    sceneType: "商品主图",
    sceneGroup: "main-image",
    sceneGroupLabel: "主图模板",
    platformPresetId: "wechat-share",
    previewImage: "/templates/previews/product-main-compare.svg",
    layoutVariant: "split-info",
    layoutVariantLabel: "左右分栏",
    usageTip: "适合参数型、功能型商品，左边展示主体，右边集中放清单和价格。",
    description: "通过左右分栏拉开信息层级，适合表现卖点列表、参数对比和套餐权益。",
    componentIds: ["headline", "selling-points", "price-tag", "gift-bonus"],
    aiSlots: ["商品主体图", "参数或卖点列表"]
  },
  {
    id: "selling-cover-impact",
    label: "带货封面·强标题冲击款",
    sceneType: "带货封面",
    sceneGroup: "promo",
    sceneGroupLabel: "带货封面",
    platformPresetId: "douyin-product",
    previewImage: "/templates/previews/selling-cover-impact.svg",
    layoutVariant: "title-stack",
    layoutVariantLabel: "强标题堆叠",
    usageTip: "适合短视频封面，先做大标题冲击，再补价格和卖点节奏。",
    description: "标题占据上半区视觉中心，中下部留给商品和活动信息，适合抢眼封面。",
    componentIds: ["headline", "price-tag", "flash-sale", "selling-points"],
    aiSlots: ["封面主体图", "冲击型封面标题"]
  },
  {
    id: "selling-cover-host",
    label: "带货封面·人物口播款",
    sceneType: "带货封面",
    sceneGroup: "promo",
    sceneGroupLabel: "带货封面",
    platformPresetId: "douyin-live-cover",
    previewImage: "/templates/previews/selling-cover-host.svg",
    layoutVariant: "host-focus",
    layoutVariantLabel: "人物口播版",
    usageTip: "适合达人口播和主播讲解素材，保留中部人物站位和底部权益栏。",
    description: "顶部标题清晰，中部聚焦人物或商品，底部集中展示包邮和价格权益。",
    componentIds: ["headline", "new-tag", "price-tag", "free-shipping"],
    aiSlots: ["人物或商品主体", "口播利益点"]
  },
  {
    id: "promo-banner-convert",
    label: "促销海报·券后成交款",
    sceneType: "促销海报",
    sceneGroup: "promo",
    sceneGroupLabel: "促销海报",
    platformPresetId: "wechat-share",
    previewImage: "/templates/previews/promo-banner-convert.svg",
    layoutVariant: "coupon-board",
    layoutVariantLabel: "券后成交版",
    usageTip: "适合社群活动、秒杀通知和私域传播，把券后价和限时信息做强。",
    description: "优惠券、价格、闪购和赠品形成完整成交链路，适合高信息密度促销图。",
    componentIds: ["headline", "coupon-badge", "price-tag", "gift-bonus", "flash-sale"],
    aiSlots: ["活动主视觉", "券后价与限时活动"]
  },
  {
    id: "live-warmup-reminder",
    label: "直播预热·开播提醒款",
    sceneType: "直播预热",
    sceneGroup: "live",
    sceneGroupLabel: "直播场景",
    platformPresetId: "douyin-live-cover",
    previewImage: "/templates/previews/live-warmup-reminder.svg",
    layoutVariant: "countdown-bottom",
    layoutVariantLabel: "倒计时底栏",
    usageTip: "适合直播预约和开播提醒，底部权益栏要一眼扫到直播信息。",
    description: "标题靠上，中部主体突出，底部整合直播提醒、福利和卖点信息。",
    componentIds: ["headline", "new-tag", "free-shipping", "selling-points"],
    aiSlots: ["主播或商品主体", "开播时间和福利信息"]
  },
  {
    id: "rednote-checklist",
    label: "小红书封面·清单种草款",
    sceneType: "内容封面",
    sceneGroup: "content-cover",
    sceneGroupLabel: "内容封面",
    platformPresetId: "xiaohongshu-cover",
    previewImage: "/templates/previews/rednote-checklist.svg",
    layoutVariant: "checklist-card",
    layoutVariantLabel: "清单种草版",
    usageTip: "适合种草笔记、测评合集和清单封面，标题控制在 2 到 3 行更自然。",
    description: "减少纯促销电商感，用清单卡片和轻标签组织信息，适合内容型封面。",
    componentIds: ["headline", "selling-points", "gift-bonus"],
    aiSlots: ["封面主体图", "清单摘要"]
  }
];

const fallbackComponentLayout: Record<BusinessComponentPresetId, RelativeRect> = {
  headline: { x: 0.08, y: 0.08, width: 0.52, height: 0.14 },
  "price-tag": { x: 0.08, y: 0.72, width: 0.32, height: 0.12 },
  "coupon-badge": { x: 0.62, y: 0.12, width: 0.24, height: 0.1 },
  "flash-sale": { x: 0.08, y: 0.56, width: 0.3, height: 0.1 },
  "new-tag": { x: 0.7, y: 0.08, width: 0.2, height: 0.1 },
  "free-shipping": { x: 0.08, y: 0.84, width: 0.24, height: 0.08 },
  "gift-bonus": { x: 0.62, y: 0.76, width: 0.24, height: 0.1 },
  "selling-points": { x: 0.08, y: 0.82, width: 0.48, height: 0.16 }
};

const templateLayouts: Record<TemplateDefinitionId, TemplateLayout> = {
  "product-main-hero": {
    canvasBackground: "#fbf6ef",
    displayColor: "#fbf6ef",
    image: { x: 0.18, y: 0.2, scaleX: 0.62, scaleY: 0.62 },
    components: {
      headline: { x: 0.08, y: 0.08, width: 0.5, height: 0.14, style: { fontSize: 78 } },
      "coupon-badge": { x: 0.68, y: 0.1, width: 0.2, height: 0.1, content: "领券减 30" },
      "price-tag": { x: 0.08, y: 0.69, width: 0.34, height: 0.12, content: "到手价 ¥59", style: { fontSize: 68 } },
      "selling-points": {
        x: 0.58,
        y: 0.68,
        width: 0.28,
        height: 0.17,
        content: "• 大容量更耐用\n• 成分更温和\n• 即买即用",
        style: { fontSize: 30, strokeWidth: 2, backgroundColor: "#fffaf3", gradient: ["#ffffff", "#f3efe6"], fill: "#30423d", stroke: "#fffaf4" }
      }
    }
  },
  "product-main-price": {
    canvasBackground: "#f8f3ea",
    displayColor: "#f8f3ea",
    image: { x: 0.07, y: 0.25, scaleX: 0.62, scaleY: 0.62 },
    components: {
      headline: { x: 0.08, y: 0.08, width: 0.4, height: 0.12, style: { fontSize: 66 } },
      "price-tag": { x: 0.56, y: 0.22, width: 0.28, height: 0.12, content: "券后 ¥39", style: { fontSize: 74 } },
      "flash-sale": { x: 0.56, y: 0.38, width: 0.24, height: 0.1, content: "今日闪购", style: { fontSize: 48 } },
      "coupon-badge": { x: 0.56, y: 0.52, width: 0.24, height: 0.1, content: "下单立减", style: { fontSize: 42 } }
    }
  },
  "product-main-compare": {
    canvasBackground: "#f6f1e8",
    displayColor: "#f6f1e8",
    image: { x: 0.04, y: 0.24, scaleX: 0.52, scaleY: 0.52 },
    components: {
      headline: { x: 0.07, y: 0.08, width: 0.36, height: 0.12, style: { fontSize: 62 } },
      "selling-points": {
        x: 0.56,
        y: 0.24,
        width: 0.28,
        height: 0.24,
        content: "• 参数更全\n• 质感更好\n• 套装更省心",
        style: { fontSize: 30, strokeWidth: 2, backgroundColor: "#fffaf5", gradient: ["#ffffff", "#f7f0e4"], fill: "#2f403a", stroke: "#fffdf7" }
      },
      "price-tag": { x: 0.56, y: 0.58, width: 0.28, height: 0.12, content: "组合价 ¥129", style: { fontSize: 60 } },
      "gift-bonus": { x: 0.56, y: 0.74, width: 0.22, height: 0.08, content: "赠替换装", style: { fontSize: 34 } }
    }
  },
  "selling-cover-impact": {
    canvasBackground: "#f8f1e8",
    displayColor: "#f8f1e8",
    image: { x: 0.19, y: 0.34, scaleX: 0.56, scaleY: 0.56 },
    components: {
      headline: { x: 0.08, y: 0.08, width: 0.72, height: 0.18, content: "3 天出门妆\n直接抄这套", style: { fontSize: 70 } },
      "flash-sale": { x: 0.1, y: 0.56, width: 0.22, height: 0.09, content: "限时冲刺", style: { fontSize: 42 } },
      "price-tag": { x: 0.08, y: 0.71, width: 0.32, height: 0.12, content: "爆款价 ¥79", style: { fontSize: 64 } },
      "selling-points": {
        x: 0.55,
        y: 0.68,
        width: 0.24,
        height: 0.14,
        content: "• 轻松上镜\n• 显白显气色",
        style: { fontSize: 28, strokeWidth: 2, backgroundColor: "#fffaf5", gradient: ["#ffffff", "#f8efe3"], fill: "#334640", stroke: "#fff8f1" }
      }
    }
  },
  "selling-cover-host": {
    canvasBackground: "#f7efe5",
    displayColor: "#f7efe5",
    image: { x: 0.17, y: 0.24, scaleX: 0.68, scaleY: 0.68 },
    components: {
      headline: { x: 0.08, y: 0.09, width: 0.66, height: 0.14, content: "直播间实测\n这一件真的能打", style: { fontSize: 66 } },
      "new-tag": { x: 0.7, y: 0.08, width: 0.18, height: 0.08, content: "直播专享", style: { fontSize: 34 } },
      "price-tag": { x: 0.1, y: 0.79, width: 0.28, height: 0.1, content: "开播价 ¥99", style: { fontSize: 52 } },
      "free-shipping": { x: 0.56, y: 0.8, width: 0.22, height: 0.08, content: "包邮+赠险", style: { fontSize: 34 } }
    }
  },
  "promo-banner-convert": {
    canvasBackground: "#fbf4ea",
    displayColor: "#fbf4ea",
    image: { x: 0.12, y: 0.24, scaleX: 0.48, scaleY: 0.48 },
    components: {
      headline: { x: 0.08, y: 0.08, width: 0.72, height: 0.14, content: "活动最后 48 小时\n今天下单最划算", style: { fontSize: 64 } },
      "coupon-badge": { x: 0.6, y: 0.28, width: 0.24, height: 0.1, content: "满 199 减 50", style: { fontSize: 40 } },
      "price-tag": { x: 0.56, y: 0.42, width: 0.28, height: 0.12, content: "券后 ¥149", style: { fontSize: 66 } },
      "flash-sale": { x: 0.56, y: 0.58, width: 0.24, height: 0.08, content: "今晚 24 点结束", style: { fontSize: 34 } },
      "gift-bonus": { x: 0.56, y: 0.72, width: 0.24, height: 0.08, content: "再送小样礼盒", style: { fontSize: 34 } }
    }
  },
  "live-warmup-reminder": {
    canvasBackground: "#f6efe4",
    displayColor: "#f6efe4",
    image: { x: 0.14, y: 0.22, scaleX: 0.72, scaleY: 0.72 },
    components: {
      headline: { x: 0.08, y: 0.08, width: 0.76, height: 0.12, content: "今晚 20:00 准时开播", style: { fontSize: 60 } },
      "new-tag": { x: 0.1, y: 0.72, width: 0.2, height: 0.08, content: "预约提醒", style: { fontSize: 34 } },
      "free-shipping": { x: 0.36, y: 0.72, width: 0.22, height: 0.08, content: "下单包邮", style: { fontSize: 34 } },
      "selling-points": {
        x: 0.08,
        y: 0.82,
        width: 0.72,
        height: 0.12,
        content: "• 前 100 名送礼\n• 直播间专属券\n• 人气单品一次讲透",
        style: { fontSize: 24, strokeWidth: 2, backgroundColor: "#fffaf4", gradient: ["#ffffff", "#f3eadf"], fill: "#32423d", stroke: "#fff8f1" }
      }
    }
  },
  "rednote-checklist": {
    canvasBackground: "#f7f2ea",
    displayColor: "#f7f2ea",
    image: { x: 0.14, y: 0.3, scaleX: 0.58, scaleY: 0.58 },
    components: {
      headline: { x: 0.08, y: 0.08, width: 0.72, height: 0.14, content: "新手入门别乱买\n这 3 样先收好", style: { fontSize: 58 } },
      "gift-bonus": { x: 0.1, y: 0.24, width: 0.2, height: 0.08, content: "清单收藏", style: { fontSize: 30 } },
      "selling-points": {
        x: 0.52,
        y: 0.44,
        width: 0.28,
        height: 0.2,
        content: "1. 入门基础款\n2. 回购高频款\n3. 不踩雷替代款",
        style: { fontSize: 28, strokeWidth: 2, backgroundColor: "#fffdf9", gradient: ["#ffffff", "#f6f0e6"], fill: "#32433d", stroke: "#fffaf4" }
      }
    }
  }
};

const defaultTextContentByTemplateId: Record<Exclude<BusinessComponentPreset["templateTextId"], undefined>, string> = {
  title: "主标题文案",
  price: "到手价 ¥59",
  coupon: "领券减 30",
  flash: "限时闪购",
  new: "新品首发",
  hot: "爆款推荐",
  free: "全店包邮",
  gift: "加赠礼盒",
  digital: "科技新品"
};

function slugify(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function toAbsoluteRect(rect: RelativeRect, canvasWidth: number, canvasHeight: number) {
  return {
    x: Math.round(canvasWidth * rect.x),
    y: Math.round(canvasHeight * rect.y),
    width: Math.round(canvasWidth * rect.width),
    height: Math.round(canvasHeight * rect.height)
  };
}

function getTemplateLayout(templateId: TemplateDefinitionId) {
  return templateLayouts[templateId];
}

function getComponentLayout(
  templateId: TemplateDefinitionId,
  componentId: BusinessComponentPresetId,
  canvasWidth: number,
  canvasHeight: number
) {
  const templateLayout = getTemplateLayout(templateId);
  const relativeRect = templateLayout.components[componentId] ?? fallbackComponentLayout[componentId];

  return {
    ...toAbsoluteRect(relativeRect, canvasWidth, canvasHeight),
    content: templateLayout.components[componentId]?.content,
    style: templateLayout.components[componentId]?.style
  };
}

function getBaseTextStyleOverrides(component: BusinessComponentPreset): TemplateTextOverrides {
  if (component.templateTextId === "price") {
    return { fontSize: 72 };
  }

  if (component.templateTextId === "coupon") {
    return { fontSize: 54 };
  }

  if (component.id === "selling-points") {
    return {
      fontSize: 34,
      strokeWidth: 2,
      backgroundColor: "#fffaf3",
      gradient: ["#ffffff", "#f4efe6"],
      fill: "#30413c",
      stroke: "#fff8f1"
    };
  }

  return {};
}

function buildDefaultTextContent(component: BusinessComponentPreset) {
  if (component.content) {
    return component.content;
  }

  if (component.templateTextId) {
    return defaultTextContentByTemplateId[component.templateTextId];
  }

  return "模板文案";
}

function createTextLayerFromComponent(
  templateId: TemplateDefinitionId,
  component: BusinessComponentPreset,
  canvasWidth: number,
  canvasHeight: number,
  zIndex: number
): TextLayer {
  const baseStyle = createDefaultTextStyle();
  const position = getComponentLayout(templateId, component.id, canvasWidth, canvasHeight);

  return {
    id: createLayerId("text"),
    type: "text",
    name: component.label,
    visible: true,
    locked: false,
    opacity: 1,
    zIndex,
    transform: {
      ...createDefaultTransform(),
      x: position.x,
      y: position.y
    },
    content: position.content ?? buildDefaultTextContent(component),
    textTemplateId: (component.templateTextId as TextLayer["textTemplateId"]) ?? null,
    businessComponentId: component.id,
    businessComponentLabel: component.label,
    style: {
      ...baseStyle,
      ...getBaseTextStyleOverrides(component),
      ...position.style
    }
  };
}

function createDecorationLayerFromComponent(
  templateId: TemplateDefinitionId,
  component: BusinessComponentPreset,
  canvasWidth: number,
  canvasHeight: number,
  zIndex: number
): DecorationLayer {
  const position = getComponentLayout(templateId, component.id, canvasWidth, canvasHeight);

  return {
    id: createLayerId("decoration"),
    type: "decoration",
    name: component.label,
    visible: true,
    locked: false,
    opacity: 1,
    zIndex,
    transform: {
      ...createDefaultTransform(),
      x: position.x,
      y: position.y
    },
    businessComponentId: component.id,
    businessComponentLabel: component.label,
    decorationKind: "shape",
    shape: "rectangle",
    sticker: "sparkle",
    width: position.width,
    height: position.height,
    fill: "#cf5b2d"
  };
}

function getTextBounds(layer: TextLayer) {
  const width = Math.max(180, layer.content.split("\n").reduce((max, line) => Math.max(max, line.length), 0) * layer.style.fontSize * 0.68);
  const lineCount = layer.content.split("\n").length;
  const height = Math.max(layer.style.fontSize * 1.6, lineCount * layer.style.fontSize * 1.28);

  return {
    left: layer.transform.x,
    top: layer.transform.y,
    right: layer.transform.x + width * layer.transform.scaleX,
    bottom: layer.transform.y + height * layer.transform.scaleY
  };
}

function getLayerBounds(layer: EditorLayer) {
  if (layer.type === "text") {
    return getTextBounds(layer);
  }

  if (layer.type === "decoration") {
    return {
      left: layer.transform.x,
      top: layer.transform.y,
      right: layer.transform.x + layer.width * layer.transform.scaleX,
      bottom: layer.transform.y + layer.height * layer.transform.scaleY
    };
  }

  if (layer.type === "image") {
    return {
      left: layer.transform.x,
      top: layer.transform.y,
      right: layer.transform.x + layer.crop.width * layer.transform.scaleX,
      bottom: layer.transform.y + layer.crop.height * layer.transform.scaleY
    };
  }

  const maxX = Math.max(...layer.points.map((point) => point.x), 1);
  const maxY = Math.max(...layer.points.map((point) => point.y), 1);

  return {
    left: layer.transform.x,
    top: layer.transform.y,
    right: layer.transform.x + maxX * layer.transform.scaleX,
    bottom: layer.transform.y + maxY * layer.transform.scaleY
  };
}

function overlaps(a: ReturnType<typeof getLayerBounds>, b: ReturnType<typeof getLayerBounds>) {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
}

export function getPlatformPreset(presetId: string | null | undefined) {
  return platformPresets.find((preset) => preset.id === presetId) ?? platformPresets[0];
}

export function getTemplateDefinition(templateId: string | null | undefined) {
  return templateDefinitions.find((template) => template.id === templateId) ?? templateDefinitions[0];
}

export function getBusinessComponentPreset(componentId: string | null | undefined) {
  return businessComponentPresets.find((component) => component.id === componentId) ?? businessComponentPresets[0];
}

export function createTemplateDocument(templateId: TemplateDefinitionId): EditorDocument {
  const template = getTemplateDefinition(templateId);
  const platformPreset = getPlatformPreset(template.platformPresetId);
  const canvasPreset = getCanvasPreset(platformPreset.canvasPresetId);
  const exportConfig = createDefaultExportConfig(canvasPreset);
  const layout = getTemplateLayout(template.id);
  exportConfig.format = platformPreset.recommendedFormat;

  const layers: EditorLayer[] = [
    {
      id: createLayerId("image"),
      name: "AIGC Base Image",
      type: "image",
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 0,
      transform: {
        ...createDefaultTransform(),
        x: Math.round(canvasPreset.width * layout.image.x),
        y: Math.round(canvasPreset.height * layout.image.y),
        scaleX: layout.image.scaleX,
        scaleY: layout.image.scaleY
      },
      source: "pending-upload",
      assetId: null,
      sourceUrl: null,
      sourceDataUrl: null,
      sourceOrigin: "local",
      originalWidth: 960,
      originalHeight: 960,
      crop: createImageCrop(960, 960),
      presetFilterId: null,
      enhanceProfileId: null,
      filters: createDefaultImageFilters(),
      aiMeta: createDefaultImageAiMeta()
    }
  ];

  template.componentIds.forEach((componentId, index) => {
    const component = getBusinessComponentPreset(componentId);
    const layer =
      component.kind === "decoration"
        ? createDecorationLayerFromComponent(template.id, component, canvasPreset.width, canvasPreset.height, index + 1)
        : createTextLayerFromComponent(template.id, component, canvasPreset.width, canvasPreset.height, index + 1);

    layers.push(layer);
  });

  const document: EditorDocument = {
    id: `template-${template.id}`,
    version: 1,
    name: template.label,
    canvas: {
      presetId: canvasPreset.id,
      width: canvasPreset.width,
      height: canvasPreset.height,
      backgroundColor: layout.canvasBackground,
      displayBackground: {
        mode: "grid",
        color: layout.displayColor
      },
      safeAreaInset: platformPreset.safeAreaInset,
      viewport: {
        zoom: 0.5,
        panX: 0,
        panY: 0
      }
    },
    layers,
    exportConfig,
    renderRequest: createDefaultRenderRequest(
      {
        width: canvasPreset.width,
        height: canvasPreset.height,
        backgroundColor: layout.canvasBackground
      },
      exportConfig
    ),
    assetRegistry: createDefaultAssetRegistry(),
    draftMeta: {
      enabled: true,
      storageKey: "web-ps/editor-draft",
      lastSavedAt: null
    },
    workflowMeta: {
      sceneTag: platformPreset.sceneTag,
      version: 1,
      lastExportedAt: null,
      lastAppliedAt: null,
      returnMode: "postmessage",
      targetOrigin: "*",
      sessionId: null
    },
    templateMeta: {
      ...createDefaultTemplateMeta(),
      templateId: template.id,
      templateName: template.label,
      sceneType: template.sceneType,
      platformPresetId: platformPreset.id,
      platformName: platformPreset.label,
      usageTip: template.usageTip,
      aiSlots: template.aiSlots
    },
    validation: createDefaultValidationState(),
    updatedAt: new Date().toISOString()
  };

  return validateDocument(document);
}

export function applyPlatformPresetToDocument(
  document: EditorDocument,
  presetId: PlatformPresetId
): EditorDocument {
  const platformPreset = getPlatformPreset(presetId);
  const canvasPreset = getCanvasPreset(platformPreset.canvasPresetId);

  const nextDocument: EditorDocument = {
    ...document,
    canvas: {
      ...document.canvas,
      presetId: canvasPreset.id,
      width: canvasPreset.width,
      height: canvasPreset.height,
      safeAreaInset: platformPreset.safeAreaInset
    },
    exportConfig: {
      ...document.exportConfig,
      format: platformPreset.recommendedFormat,
      width: canvasPreset.width,
      height: canvasPreset.height,
      sizePreset: "group"
    },
    renderRequest: {
      ...document.renderRequest,
      format: platformPreset.recommendedFormat,
      width: canvasPreset.width,
      height: canvasPreset.height,
      sizePreset: "group",
      background: {
        ...document.renderRequest.background,
        color: document.canvas.backgroundColor
      }
    },
    workflowMeta: {
      ...document.workflowMeta,
      sceneTag: platformPreset.sceneTag
    },
    templateMeta: {
      ...document.templateMeta,
      platformPresetId: platformPreset.id,
      platformName: platformPreset.label
    },
    updatedAt: new Date().toISOString()
  };

  return validateDocument(nextDocument);
}

export function insertBusinessComponentLayer(
  document: EditorDocument,
  componentId: BusinessComponentPresetId
) {
  const component = getBusinessComponentPreset(componentId);
  const templateId = (document.templateMeta.templateId as TemplateDefinitionId | null) ?? templateDefinitions[0].id;
  const layer =
    component.kind === "decoration"
      ? createDecorationLayerFromComponent(templateId, component, document.canvas.width, document.canvas.height, document.layers.length)
      : createTextLayerFromComponent(templateId, component, document.canvas.width, document.canvas.height, document.layers.length);

  const nextDocument = {
    ...document,
    layers: [...document.layers, layer],
    updatedAt: new Date().toISOString()
  } satisfies EditorDocument;

  return {
    document: validateDocument(nextDocument),
    layerId: layer.id
  };
}

function buildSummary(issues: ValidationState["issues"]) {
  const failing = issues.filter((issue) => !issue.passed);

  if (failing.length === 0) {
    return "Ready to export. Core ecommerce checks passed.";
  }

  return `${failing.length} item(s) need attention before export.`;
}

export function buildSuggestedExportFilename(document: EditorDocument) {
  const platformPreset = getPlatformPreset(document.templateMeta.platformPresetId);
  const templateSlug = slugify(document.templateMeta.templateName ?? document.name ?? "template");
  const version = `v${String(document.workflowMeta.version).padStart(3, "0")}`;

  return platformPreset.fileNamePattern
    .replace("{template}", templateSlug)
    .replace("{version}", version);
}

export function validateDocument(document: EditorDocument): EditorDocument {
  const safeArea = {
    left: document.canvas.safeAreaInset,
    top: document.canvas.safeAreaInset,
    right: document.canvas.width - document.canvas.safeAreaInset,
    bottom: document.canvas.height - document.canvas.safeAreaInset
  };

  const platformPreset = getPlatformPreset(document.templateMeta.platformPresetId);
  const textLayers = document.layers.filter((layer): layer is TextLayer => layer.type === "text" && layer.visible);
  const imageLayer = document.layers.find((layer): layer is Extract<EditorLayer, { type: "image" }> => layer.type === "image" && layer.visible);
  const businessLayers = document.layers.filter(
    (layer) =>
      layer.visible &&
      (layer.type === "text" || layer.type === "decoration") &&
      ((layer.type === "text" &&
        (layer.businessComponentId === "headline" || layer.businessComponentId === "price-tag" || layer.businessComponentId === "coupon-badge")) ||
        (layer.type === "decoration" &&
          (layer.businessComponentId === "headline" || layer.businessComponentId === "price-tag" || layer.businessComponentId === "coupon-badge")))
  );

  const textInsideSafeArea = textLayers.every((layer) => {
    const bounds = getLayerBounds(layer);
    return bounds.left >= safeArea.left && bounds.top >= safeArea.top && bounds.right <= safeArea.right && bounds.bottom <= safeArea.bottom;
  });

  const imageHealthy = (() => {
    if (!imageLayer) {
      return false;
    }

    const bounds = getLayerBounds(imageLayer);
    const coverage = ((bounds.right - bounds.left) * (bounds.bottom - bounds.top)) / (document.canvas.width * document.canvas.height);
    const staysInside = bounds.left >= 0 && bounds.top >= 0 && bounds.right <= document.canvas.width && bounds.bottom <= document.canvas.height;

    return coverage >= 0.16 && staysInside;
  })();

  let overlapCount = 0;
  for (let index = 0; index < businessLayers.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < businessLayers.length; compareIndex += 1) {
      if (overlaps(getLayerBounds(businessLayers[index]), getLayerBounds(businessLayers[compareIndex]))) {
        overlapCount += 1;
      }
    }
  }

  const canvasMatchesPlatform =
    document.canvas.width === getCanvasPreset(platformPreset.canvasPresetId).width &&
    document.canvas.height === getCanvasPreset(platformPreset.canvasPresetId).height;

  const exportFormatMatches = document.exportConfig.format === platformPreset.recommendedFormat;

  const issues: ValidationState["issues"] = [
    {
      id: "safe-area-text",
      severity: "warning",
      passed: textInsideSafeArea,
      message: textInsideSafeArea ? "Text components stay inside the safe area." : "Some text content exceeds the recommended safe area."
    },
    {
      id: "image-coverage",
      severity: "warning",
      passed: imageHealthy,
      message: imageHealthy ? "The product image has healthy coverage." : "The product image is too small or touches the edge."
    },
    {
      id: "component-overlap",
      severity: "warning",
      passed: overlapCount === 0,
      message: overlapCount === 0 ? "Headline, price, and coupon components do not overlap." : "Key business components are overlapping."
    },
    {
      id: "platform-aspect",
      severity: "warning",
      passed: canvasMatchesPlatform,
      message: canvasMatchesPlatform ? "Canvas matches the selected platform preset." : "Canvas ratio does not match the selected platform preset."
    },
    {
      id: "export-format",
      severity: "info",
      passed: exportFormatMatches,
      message: exportFormatMatches ? "Export format matches the platform recommendation." : `Recommended export format is ${platformPreset.recommendedFormat.toUpperCase()}.`
    }
  ];

  return {
    ...document,
    validation: {
      status: "ready",
      summary: buildSummary(issues),
      issues,
      checkedAt: new Date().toISOString()
    }
  };
}
