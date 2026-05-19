import { z } from "zod";
import {
  canvasBackgroundModes,
  canvasPresets,
  decorationKinds,
  decorationShapeIds,
  decorationStickerIds,
  enhanceProfileIds,
  imagePresetFilterIds,
  layerTypes,
  textTemplateIds
} from "./document";

const presetIds = canvasPresets.map((preset) => preset.id) as [
  (typeof canvasPresets)[number]["id"],
  ...(typeof canvasPresets)[number]["id"][]
];

const layerTypeValues = [...layerTypes] as [
  (typeof layerTypes)[number],
  ...(typeof layerTypes)[number][]
];

const textTemplateValues = [...textTemplateIds] as [
  (typeof textTemplateIds)[number],
  ...(typeof textTemplateIds)[number][]
];

const imagePresetValues = [...imagePresetFilterIds] as [
  (typeof imagePresetFilterIds)[number],
  ...(typeof imagePresetFilterIds)[number][]
];

const enhanceProfileValues = [...enhanceProfileIds] as [
  (typeof enhanceProfileIds)[number],
  ...(typeof enhanceProfileIds)[number][]
];

const canvasBackgroundModeValues = [...canvasBackgroundModes] as [
  (typeof canvasBackgroundModes)[number],
  ...(typeof canvasBackgroundModes)[number][]
];

const decorationKindValues = [...decorationKinds] as [
  (typeof decorationKinds)[number],
  ...(typeof decorationKinds)[number][]
];

const decorationShapeValues = [...decorationShapeIds] as [
  (typeof decorationShapeIds)[number],
  ...(typeof decorationShapeIds)[number][]
];

const decorationStickerValues = [...decorationStickerIds] as [
  (typeof decorationStickerIds)[number],
  ...(typeof decorationStickerIds)[number][]
];

const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
  rotation: z.number(),
  flipX: z.boolean(),
  flipY: z.boolean()
});

const layerBaseSchema = z.object({
  id: z.string(),
  type: z.enum(layerTypeValues),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: z.number().min(0).max(1),
  zIndex: z.number().int(),
  transform: transformSchema
});

const imageLayerSchema = layerBaseSchema.extend({
  type: z.literal("image"),
  source: z.string(),
  originalWidth: z.number().positive(),
  originalHeight: z.number().positive(),
  crop: z.object({
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive()
  }),
  presetFilterId: z.enum(imagePresetValues).nullable(),
  enhanceProfileId: z.enum(enhanceProfileValues).nullable(),
  filters: z.object({
    intensity: z.number().default(100),
    brightness: z.number(),
    contrast: z.number(),
    saturation: z.number(),
    vibrance: z.number().default(0),
    blur: z.number(),
    sharpen: z.number(),
    temperature: z.number(),
    hue: z.number().default(0)
  }),
  aiMeta: z.object({
    prompt: z.string(),
    expandPrompt: z.string(),
    lastAiAction: z.enum(["seed3d", "outpaint"]).nullable(),
    lastAiRequestedAt: z.string().nullable(),
    lastAiSucceededAt: z.string().nullable(),
    lastAiError: z.string().nullable(),
    model3dTask: z
      .object({
        taskId: z.string().nullable(),
        status: z.enum(["idle", "pending", "running", "succeeded", "failed"]),
        downloadUrl: z.string().nullable(),
        fileName: z.string().nullable(),
        providerModel: z.string().nullable()
      })
      .default({
        taskId: null,
        status: "idle",
        downloadUrl: null,
        fileName: null,
        providerModel: null
      })
  })
})
  .passthrough()
  .transform((layer) => {
    const { mask: _legacyMask, ...rest } = layer as typeof layer & { mask?: unknown };
    return rest;
  });

const textLayerSchema = layerBaseSchema.extend({
  type: z.literal("text"),
  content: z.string(),
  textTemplateId: z.enum(textTemplateValues).nullable(),
  style: z.object({
    fontFamily: z.string(),
    fontSize: z.number(),
    fontWeight: z.number(),
    fill: z.string(),
    stroke: z.string(),
    strokeWidth: z.number(),
    shadow: z.string(),
    backgroundColor: z.string(),
    gradient: z.array(z.string())
  })
});

const decorationLayerSchema = layerBaseSchema.extend({
  type: z.literal("decoration"),
  decorationKind: z.enum(decorationKindValues).default("shape"),
  shape: z
    .enum(decorationShapeValues)
    .or(z.enum(["ribbon", "badge", "highlight"]))
    .transform((value) => {
      if (value === "badge") {
        return "heart";
      }

      if (value === "ribbon") {
        return "rectangle";
      }

      if (value === "highlight") {
        return "rectangle";
      }

      return value;
    }),
  sticker: z.enum(decorationStickerValues).default("sparkle"),
  width: z.number().positive().default(220),
  height: z.number().positive().default(140),
  fill: z.string()
});

const doodleLayerSchema = layerBaseSchema.extend({
  type: z.literal("doodle"),
  points: z.array(
    z.object({
      x: z.number(),
      y: z.number()
    })
  ),
  stroke: z.string(),
  strokeWidth: z.number().positive()
});

const exportConfigSchema = z.union([
  z.object({
    format: z.enum(["png", "jpeg"]),
    quality: z.number().min(0).max(1),
    scale: z.number().positive(),
    qualityPreset: z.enum(["standard", "high"]),
    resizeMode: z.enum(["fixed", "scale"]),
    sizePreset: z.enum(["group", "free", "1inch", "2inch"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    scalePercent: z.number().positive()
  }),
  z
    .object({
      format: z.enum(["png", "jpeg"]),
      quality: z.number().min(0).max(1),
      scale: z.number().positive()
    })
    .transform((legacy) => ({
      format: legacy.format,
      quality: legacy.quality,
      scale: legacy.scale,
      qualityPreset: legacy.quality >= 0.9 ? "high" : "standard",
      resizeMode: "scale" as const,
      sizePreset: "group" as const,
      width: 1080,
      height: 1350,
      scalePercent: Math.round(legacy.scale * 100)
    }))
]);

export const editorDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  canvas: z.object({
    presetId: z.enum(presetIds),
    width: z.number().positive(),
    height: z.number().positive(),
    backgroundColor: z.string(),
    displayBackground: z
      .object({
        mode: z.enum(canvasBackgroundModeValues),
        color: z.string()
      })
      .default({
        mode: "grid",
        color: "#fbf6ef"
      }),
    safeAreaInset: z.number().nonnegative(),
    viewport: z.object({
      zoom: z.number().positive(),
      panX: z.number(),
      panY: z.number()
    })
  }),
  layers: z.array(
    z.discriminatedUnion("type", [
      imageLayerSchema,
      textLayerSchema,
      decorationLayerSchema,
      doodleLayerSchema
    ])
  ),
  exportConfig: exportConfigSchema,
  draftMeta: z.object({
    enabled: z.boolean(),
    storageKey: z.string(),
    lastSavedAt: z.string().nullable()
  }),
  workflowMeta: z.object({
    sceneTag: z.string(),
    version: z.number().int().positive(),
    lastExportedAt: z.string().nullable(),
    lastAppliedAt: z.string().nullable(),
    returnMode: z.literal("postmessage"),
    targetOrigin: z.string(),
    sessionId: z.string().nullable()
  }),
  updatedAt: z.string()
});
