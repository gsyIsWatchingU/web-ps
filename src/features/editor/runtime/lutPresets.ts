import type { ImagePresetFilterId } from "../model/document";

export type LutPresetCategory = "portrait" | "food" | "product" | "mood";

export type LutPresetConfig = {
  id: ImagePresetFilterId;
  category: LutPresetCategory;
  lutAssetPath: string;
  defaultIntensity: number;
};

type Color = [number, number, number];

type LutTransform = (color: Color) => Color;

const LUT_SIZE = 16;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function applyContrast(color: Color, amount: number): Color {
  return color.map((channel) => clamp01((channel - 0.5) * amount + 0.5)) as Color;
}

function applyLiftGammaGain(
  color: Color,
  lift: Color,
  gamma: Color,
  gain: Color
): Color {
  return color.map((channel, index) => {
    const lifted = clamp01(channel + lift[index]);
    const gammaAdjusted = Math.pow(lifted, gamma[index]);
    return clamp01(gammaAdjusted * gain[index]);
  }) as Color;
}

function applySaturation(color: Color, amount: number): Color {
  const luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  return color.map((channel) => clamp01(mix(luma, channel, amount))) as Color;
}

function applyCrossProcess(
  color: Color,
  matrix: [number, number, number][]
): Color {
  const [r, g, b] = color;
  return [
    clamp01(r * matrix[0][0] + g * matrix[0][1] + b * matrix[0][2]),
    clamp01(r * matrix[1][0] + g * matrix[1][1] + b * matrix[1][2]),
    clamp01(r * matrix[2][0] + g * matrix[2][1] + b * matrix[2][2])
  ];
}

function applyFade(color: Color, amount: number): Color {
  return color.map((channel) => clamp01(mix(channel, 0.5, amount))) as Color;
}

function applyWarmSplit(color: Color, shadows: number, highlights: number): Color {
  const brightness = (color[0] + color[1] + color[2]) / 3;
  const shadowWeight = clamp01((0.55 - brightness) / 0.55) * shadows;
  const highlightWeight = clamp01((brightness - 0.45) / 0.55) * highlights;
  return [
    clamp01(color[0] + shadowWeight * 0.05 + highlightWeight * 0.04),
    clamp01(color[1] + shadowWeight * 0.01 + highlightWeight * 0.015),
    clamp01(color[2] - shadowWeight * 0.03 - highlightWeight * 0.02)
  ];
}

function applyCoolSplit(color: Color, shadows: number, highlights: number): Color {
  const brightness = (color[0] + color[1] + color[2]) / 3;
  const shadowWeight = clamp01((0.55 - brightness) / 0.55) * shadows;
  const highlightWeight = clamp01((brightness - 0.45) / 0.55) * highlights;
  return [
    clamp01(color[0] - shadowWeight * 0.03 + highlightWeight * 0.01),
    clamp01(color[1] + shadowWeight * 0.01 + highlightWeight * 0.015),
    clamp01(color[2] + shadowWeight * 0.05 + highlightWeight * 0.02)
  ];
}

function buildCubeText(size: number, transform: LutTransform) {
  const lines = [`TITLE "generated"`, `LUT_3D_SIZE ${size}`, "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"];

  for (let red = 0; red < size; red += 1) {
    for (let green = 0; green < size; green += 1) {
      for (let blue = 0; blue < size; blue += 1) {
        const input: Color = [
          red / (size - 1),
          green / (size - 1),
          blue / (size - 1)
        ];
        const output = transform(input);
        lines.push(output.map((value) => value.toFixed(6)).join(" "));
      }
    }
  }

  return lines.join("\n");
}

function beautyTransform(color: Color) {
  let next = applyLiftGammaGain(color, [0.015, 0.01, 0.02], [0.94, 0.97, 1.02], [1.03, 1.02, 1.01]);
  next = applySaturation(next, 1.05);
  next = applyCoolSplit(next, 0.15, 0.08);
  return applyCrossProcess(next, [
    [1.03, -0.02, -0.01],
    [0.0, 1.01, -0.01],
    [0.02, 0.01, 0.97]
  ]);
}

function foodTransform(color: Color) {
  let next = applyLiftGammaGain(color, [0.005, 0.005, -0.005], [0.96, 0.96, 1.04], [1.05, 1.03, 0.98]);
  next = applySaturation(next, 1.14);
  next = applyWarmSplit(next, 0.12, 0.18);
  return applyCrossProcess(next, [
    [1.05, 0.0, -0.02],
    [0.01, 1.0, -0.01],
    [0.02, 0.0, 0.95]
  ]);
}

function fashionTransform(color: Color) {
  let next = applyLiftGammaGain(color, [0.0, 0.0, 0.015], [0.98, 1.0, 1.03], [1.02, 1.01, 1.0]);
  next = applyContrast(next, 1.08);
  next = applySaturation(next, 0.97);
  return applyCrossProcess(next, [
    [1.0, -0.01, 0.0],
    [0.0, 1.01, -0.01],
    [0.03, 0.0, 0.98]
  ]);
}

function homeTransform(color: Color) {
  let next = applyLiftGammaGain(color, [0.02, 0.015, 0.0], [0.98, 0.99, 1.02], [1.01, 1.0, 0.99]);
  next = applyFade(next, 0.04);
  next = applyWarmSplit(next, 0.08, 0.1);
  return applySaturation(next, 0.98);
}

function freshTransform(color: Color) {
  let next = applyLiftGammaGain(color, [0.01, 0.015, 0.02], [0.95, 0.97, 1.02], [1.01, 1.02, 1.03]);
  next = applySaturation(next, 1.02);
  next = applyCoolSplit(next, 0.18, 0.12);
  return applyCrossProcess(next, [
    [0.99, 0.01, 0.0],
    [0.0, 1.02, -0.01],
    [0.03, 0.0, 0.98]
  ]);
}

function warmTransform(color: Color) {
  let next = applyLiftGammaGain(color, [0.01, 0.005, -0.01], [0.98, 0.98, 1.03], [1.04, 1.02, 0.97]);
  next = applyWarmSplit(next, 0.1, 0.2);
  next = applyFade(next, 0.03);
  return applySaturation(next, 1.04);
}

function coolTransform(color: Color) {
  let next = applyLiftGammaGain(color, [-0.005, 0.0, 0.015], [0.99, 0.99, 1.02], [0.99, 1.0, 1.03]);
  next = applyContrast(next, 1.06);
  next = applyCoolSplit(next, 0.18, 0.08);
  return applySaturation(next, 0.94);
}

function filmTransform(color: Color) {
  let next = applyLiftGammaGain(color, [0.01, 0.008, -0.005], [1.04, 1.02, 1.08], [0.98, 0.97, 0.94]);
  next = applyWarmSplit(next, 0.05, 0.06);
  next = applyFade(next, 0.08);
  next = applySaturation(next, 0.86);
  return applyCrossProcess(next, [
    [1.0, 0.0, 0.0],
    [0.01, 0.98, 0.01],
    [0.02, 0.02, 0.94]
  ]);
}

function monoTransform(color: Color) {
  const luma = clamp01(color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722);
  const contrast = clamp01((luma - 0.5) * 1.18 + 0.5);
  return [contrast, contrast, contrast] as Color;
}

function clearTransform(color: Color) {
  let next = applyLiftGammaGain(color, [0.005, 0.005, 0.005], [0.97, 0.98, 0.99], [1.02, 1.02, 1.02]);
  next = applyContrast(next, 1.1);
  return applySaturation(next, 1.01);
}

const presetTransforms: Record<ImagePresetFilterId, LutTransform> = {
  beauty: beautyTransform,
  food: foodTransform,
  fashion: fashionTransform,
  home: homeTransform,
  fresh: freshTransform,
  warm: warmTransform,
  cool: coolTransform,
  film: filmTransform,
  mono: monoTransform,
  clear: clearTransform
};

export const lutPresetConfigs: Record<ImagePresetFilterId, LutPresetConfig> = {
  beauty: { id: "beauty", category: "portrait", lutAssetPath: "builtin://beauty.cube", defaultIntensity: 76 },
  food: { id: "food", category: "food", lutAssetPath: "builtin://food.cube", defaultIntensity: 82 },
  fashion: { id: "fashion", category: "product", lutAssetPath: "builtin://fashion.cube", defaultIntensity: 74 },
  home: { id: "home", category: "portrait", lutAssetPath: "builtin://home.cube", defaultIntensity: 64 },
  fresh: { id: "fresh", category: "portrait", lutAssetPath: "builtin://fresh.cube", defaultIntensity: 72 },
  warm: { id: "warm", category: "mood", lutAssetPath: "builtin://warm.cube", defaultIntensity: 78 },
  cool: { id: "cool", category: "product", lutAssetPath: "builtin://cool.cube", defaultIntensity: 70 },
  film: { id: "film", category: "mood", lutAssetPath: "builtin://film.cube", defaultIntensity: 84 },
  mono: { id: "mono", category: "mood", lutAssetPath: "builtin://mono.cube", defaultIntensity: 100 },
  clear: { id: "clear", category: "product", lutAssetPath: "builtin://clear.cube", defaultIntensity: 68 }
};

const lutCubeTextMap = Object.fromEntries(
  (Object.keys(presetTransforms) as ImagePresetFilterId[]).map((id) => [
    id,
    buildCubeText(LUT_SIZE, presetTransforms[id])
  ])
) as Record<ImagePresetFilterId, string>;

export function getPresetCubeText(presetId: ImagePresetFilterId) {
  return lutCubeTextMap[presetId];
}
