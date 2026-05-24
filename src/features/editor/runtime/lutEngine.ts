import type { ImageFilters, ImageLayer, ImagePresetFilterId } from "../model/document";
import { getImageLayerSource, isPendingImageLayer } from "../model/document";
import { getPresetCubeText, lutPresetConfigs } from "./lutPresets";

type CubeLut = {
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Float32Array;
};

const lutCache = new Map<ImagePresetFilterId, CubeLut>();
const processedImageCache = new Map<string, Promise<string>>();
const previewCache = new Map<string, Promise<string>>();

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampByte(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load LUT image source."));
    image.src = source;
  });
}

function createCanvas(width: number, height: number) {
  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function parseCubeLut(cubeText: string): CubeLut {
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];

  for (const rawLine of cubeText.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || line.startsWith("TITLE")) {
      continue;
    }

    if (line.startsWith("LUT_3D_SIZE")) {
      size = Number(line.split(/\s+/)[1]);
      continue;
    }

    if (line.startsWith("DOMAIN_MIN")) {
      const [, red, green, blue] = line.split(/\s+/);
      domainMin = [Number(red), Number(green), Number(blue)];
      continue;
    }

    if (line.startsWith("DOMAIN_MAX")) {
      const [, red, green, blue] = line.split(/\s+/);
      domainMax = [Number(red), Number(green), Number(blue)];
      continue;
    }

    const channels = line.split(/\s+/).map(Number);

    if (channels.length === 3) {
      values.push(channels[0], channels[1], channels[2]);
    }
  }

  if (!size || values.length !== size * size * size * 3) {
    throw new Error("Invalid LUT cube data.");
  }

  return {
    size,
    domainMin,
    domainMax,
    data: new Float32Array(values)
  };
}

function getLut(presetId: ImagePresetFilterId) {
  const cached = lutCache.get(presetId);

  if (cached) {
    return cached;
  }

  const parsed = parseCubeLut(getPresetCubeText(presetId));
  lutCache.set(presetId, parsed);
  return parsed;
}

function getIndex(size: number, red: number, green: number, blue: number) {
  return ((red * size + green) * size + blue) * 3;
}

function sampleLut(lut: CubeLut, red: number, green: number, blue: number) {
  const normalize = (value: number, min: number, max: number) =>
    clamp01((value - min) / Math.max(max - min, 1e-5));

  const r = normalize(red, lut.domainMin[0], lut.domainMax[0]) * (lut.size - 1);
  const g = normalize(green, lut.domainMin[1], lut.domainMax[1]) * (lut.size - 1);
  const b = normalize(blue, lut.domainMin[2], lut.domainMax[2]) * (lut.size - 1);

  const r0 = Math.floor(r);
  const g0 = Math.floor(g);
  const b0 = Math.floor(b);
  const r1 = Math.min(r0 + 1, lut.size - 1);
  const g1 = Math.min(g0 + 1, lut.size - 1);
  const b1 = Math.min(b0 + 1, lut.size - 1);
  const rt = r - r0;
  const gt = g - g0;
  const bt = b - b0;

  const read = (ri: number, gi: number, bi: number) => {
    const index = getIndex(lut.size, ri, gi, bi);
    return [lut.data[index], lut.data[index + 1], lut.data[index + 2]] as const;
  };

  const c000 = read(r0, g0, b0);
  const c001 = read(r0, g0, b1);
  const c010 = read(r0, g1, b0);
  const c011 = read(r0, g1, b1);
  const c100 = read(r1, g0, b0);
  const c101 = read(r1, g0, b1);
  const c110 = read(r1, g1, b0);
  const c111 = read(r1, g1, b1);

  const mix = (a: number, bValue: number, amount: number) => a + (bValue - a) * amount;
  const blend3 = (channel: 0 | 1 | 2) => {
    const c00 = mix(c000[channel], c001[channel], bt);
    const c01 = mix(c010[channel], c011[channel], bt);
    const c10 = mix(c100[channel], c101[channel], bt);
    const c11 = mix(c110[channel], c111[channel], bt);
    const c0 = mix(c00, c01, gt);
    const c1 = mix(c10, c11, gt);
    return mix(c0, c1, rt);
  };

  return [blend3(0), blend3(1), blend3(2)] as const;
}

function applySaturation(red: number, green: number, blue: number, amount: number) {
  const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  return [
    clamp01(luma + (red - luma) * amount),
    clamp01(luma + (green - luma) * amount),
    clamp01(luma + (blue - luma) * amount)
  ] as const;
}

function applyVibrance(red: number, green: number, blue: number, amount: number) {
  if (amount === 0) {
    return [red, green, blue] as const;
  }

  const maxChannel = Math.max(red, green, blue);
  const avg = (red + green + blue) / 3;
  const delta = maxChannel - avg;
  const adjust = 1 + amount * delta * 1.6;
  return applySaturation(red, green, blue, Math.max(0, adjust));
}

function applyTemperature(red: number, green: number, blue: number, amount: number) {
  return [
    clamp01(red + amount * 0.1),
    clamp01(green + amount * 0.025),
    clamp01(blue - amount * 0.08)
  ] as const;
}

function applyHue(red: number, green: number, blue: number, amount: number) {
  if (amount === 0) {
    return [red, green, blue] as const;
  }

  const angle = amount * Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const matrix = [
    0.213 + cos * 0.787 - sin * 0.213,
    0.715 - cos * 0.715 - sin * 0.715,
    0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143,
    0.715 + cos * 0.285 + sin * 0.14,
    0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787,
    0.715 - cos * 0.715 + sin * 0.715,
    0.072 + cos * 0.928 + sin * 0.072
  ];

  return [
    clamp01(red * matrix[0] + green * matrix[1] + blue * matrix[2]),
    clamp01(red * matrix[3] + green * matrix[4] + blue * matrix[5]),
    clamp01(red * matrix[6] + green * matrix[7] + blue * matrix[8])
  ] as const;
}

function applyFilterAdjustments(red: number, green: number, blue: number, filters: ImageFilters) {
  let next = [red, green, blue] as const;

  if (filters.vibrance !== 0) {
    next = applyVibrance(next[0], next[1], next[2], filters.vibrance);
  }

  if (filters.temperature !== 0) {
    next = applyTemperature(next[0], next[1], next[2], filters.temperature);
  }

  if (filters.hue !== 0) {
    next = applyHue(next[0], next[1], next[2], filters.hue);
  }

  if (filters.saturation !== 0) {
    next = applySaturation(next[0], next[1], next[2], 1 + filters.saturation);
  }

  if (filters.contrast !== 0) {
    next = [
      clamp01((next[0] - 0.5) * (1 + filters.contrast) + 0.5),
      clamp01((next[1] - 0.5) * (1 + filters.contrast) + 0.5),
      clamp01((next[2] - 0.5) * (1 + filters.contrast) + 0.5)
    ];
  }

  if (filters.brightness !== 0) {
    next = [
      clamp01(next[0] + filters.brightness * 0.28),
      clamp01(next[1] + filters.brightness * 0.28),
      clamp01(next[2] + filters.brightness * 0.28)
    ];
  }

  return next;
}

function applyLutToImageData(
  imageData: ImageData,
  presetId: ImagePresetFilterId | null,
  filters: ImageFilters
) {
  const data = imageData.data;
  const hasLut = presetId !== null;
  const lut = presetId ? getLut(presetId) : null;
  const intensity = clamp01(filters.intensity / 100);

  for (let index = 0; index < data.length; index += 4) {
    const baseRed = data[index] / 255;
    const baseGreen = data[index + 1] / 255;
    const baseBlue = data[index + 2] / 255;

    let nextRed = baseRed;
    let nextGreen = baseGreen;
    let nextBlue = baseBlue;

    if (hasLut && lut) {
      const sampled = sampleLut(lut, baseRed, baseGreen, baseBlue);
      nextRed = baseRed + (sampled[0] - baseRed) * intensity;
      nextGreen = baseGreen + (sampled[1] - baseGreen) * intensity;
      nextBlue = baseBlue + (sampled[2] - baseBlue) * intensity;
    }

    const adjusted = applyFilterAdjustments(nextRed, nextGreen, nextBlue, filters);

    data[index] = clampByte(adjusted[0] * 255);
    data[index + 1] = clampByte(adjusted[1] * 255);
    data[index + 2] = clampByte(adjusted[2] * 255);
  }

  return imageData;
}

function createFilterCacheKey(
  source: string,
  presetId: ImagePresetFilterId | null,
  filters: ImageFilters
) {
  return JSON.stringify({
    source,
    presetId,
    intensity: filters.intensity,
    brightness: filters.brightness,
    contrast: filters.contrast,
    saturation: filters.saturation,
    vibrance: filters.vibrance,
    temperature: filters.temperature,
    hue: filters.hue
  });
}

async function renderLutImageDataUrl(
  source: string,
  presetId: ImagePresetFilterId | null,
  filters: ImageFilters
) {
  const image = await loadImage(source);
  const canvas = createCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Failed to create LUT render context.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (presetId || filters.brightness !== 0 || filters.contrast !== 0 || filters.saturation !== 0 || filters.vibrance !== 0 || filters.temperature !== 0 || filters.hue !== 0) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    context.putImageData(applyLutToImageData(imageData, presetId, filters), 0, 0);
  }

  return canvas.toDataURL("image/png");
}

export function renderProcessedImageSource(layer: ImageLayer) {
  if (isPendingImageLayer(layer)) {
    return Promise.resolve(layer.source);
  }

  const source = getImageLayerSource(layer);
  const key = createFilterCacheKey(source, layer.presetFilterId, layer.filters);
  const cached = processedImageCache.get(key);

  if (cached) {
    return cached;
  }

  const pending = renderLutImageDataUrl(source, layer.presetFilterId, layer.filters);
  processedImageCache.set(key, pending);
  return pending;
}

export function renderPresetPreviewDataUrl(source: string, presetId: ImagePresetFilterId) {
  const presetConfig = lutPresetConfigs[presetId];
  const key = `${source}:${presetId}:${presetConfig.defaultIntensity}`;
  const cached = previewCache.get(key);

  if (cached) {
    return cached;
  }

  const pending = renderLutImageDataUrl(source, presetId, {
    intensity: presetConfig.defaultIntensity,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    vibrance: 0,
    blur: 0,
    sharpen: 0,
    temperature: 0,
    hue: 0
  });

  previewCache.set(key, pending);
  return pending;
}
