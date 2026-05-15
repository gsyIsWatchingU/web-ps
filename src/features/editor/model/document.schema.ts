import { z } from "zod";
import { canvasPresets, layerTypes } from "./document";

const presetIds = canvasPresets.map((preset) => preset.id) as [
  (typeof canvasPresets)[number]["id"],
  ...(typeof canvasPresets)[number]["id"][]
];

const layerTypeValues = [...layerTypes] as [
  (typeof layerTypes)[number],
  ...(typeof layerTypes)[number][]
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
  cropHint: z.enum(["pending", "planned"]),
  filters: z.object({
    brightness: z.number(),
    contrast: z.number(),
    saturation: z.number(),
    blur: z.number(),
    sharpen: z.number(),
    temperature: z.number()
  })
});

const textLayerSchema = layerBaseSchema.extend({
  type: z.literal("text"),
  content: z.string(),
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
  shape: z.enum(["ribbon", "badge", "highlight"]),
  fill: z.string()
});

export const editorDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  canvas: z.object({
    presetId: z.enum(presetIds),
    width: z.number().positive(),
    height: z.number().positive(),
    backgroundColor: z.string(),
    safeAreaInset: z.number().nonnegative()
  }),
  layers: z.array(
    z.discriminatedUnion("type", [
      imageLayerSchema,
      textLayerSchema,
      decorationLayerSchema
    ])
  ),
  exportConfig: z.object({
    format: z.enum(["png", "jpeg"]),
    quality: z.number().min(0).max(1),
    scale: z.number().positive()
  }),
  draftMeta: z.object({
    enabled: z.boolean(),
    storageKey: z.string(),
    lastSavedAt: z.string().nullable()
  }),
  updatedAt: z.string()
});
