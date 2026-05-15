import {
  Canvas,
  FabricImage,
  Gradient,
  Group,
  Rect,
  Shadow,
  Textbox,
  filters,
  type FabricObject
} from "fabric";
import type {
  DecorationLayer,
  EditorDocument,
  EditorLayer,
  ImageLayer,
  TextLayer
} from "../model/document";

type SeedCanvasOptions = {
  showSafeArea?: boolean;
};

function applyCommonProps(object: FabricObject, layer: EditorLayer, isSelected: boolean) {
  object.set({
    left: layer.transform.x,
    top: layer.transform.y,
    scaleX: layer.transform.scaleX,
    scaleY: layer.transform.scaleY,
    angle: layer.transform.rotation,
    flipX: layer.transform.flipX,
    flipY: layer.transform.flipY,
    opacity: layer.opacity,
    selectable: !layer.locked,
    evented: !layer.locked,
    hasControls: !layer.locked,
    hasBorders: !layer.locked
  });
}

function createSafeArea(document: EditorDocument) {
  return new Rect({
    left: document.canvas.safeAreaInset,
    top: document.canvas.safeAreaInset,
    width: document.canvas.width - document.canvas.safeAreaInset * 2,
    height: document.canvas.height - document.canvas.safeAreaInset * 2,
    fill: "rgba(255,255,255,0)",
    stroke: "#c36f49",
    strokeWidth: 2,
    strokeDashArray: [14, 12],
    selectable: false,
    evented: false
  });
}

function createImagePlaceholder(layer: ImageLayer) {
  const width = layer.originalWidth;
  const height = layer.originalHeight;
  const panel = new Rect({
    left: 0,
    top: 0,
    width,
    height,
    rx: 28,
    ry: 28,
    fill: "#f4eadc",
    stroke: "#d8c4a7",
    strokeWidth: 2
  });
  const title = new Textbox("导入 AIGC 初稿", {
    left: 34,
    top: 34,
    width: Math.max(width - 68, 160),
    fontSize: 34,
    fill: "#1c2520",
    fontFamily: "Avenir Next",
    fontWeight: 700
  });
  const desc = new Textbox("这里会显示你导入的商品图或海报初稿。当前层已经预留了裁切扩展位，后续可接局部编辑与滤镜。", {
    left: 34,
    top: 100,
    width: Math.max(width - 68, 160),
    fontSize: 20,
    lineHeight: 1.5,
    fill: "#5b6a61",
    fontFamily: "Avenir Next"
  });

  return new Group([panel, title, desc], {
    left: layer.transform.x,
    top: layer.transform.y
  });
}

function buildSharpenMatrix(intensity: number) {
  return [
    0,
    -intensity,
    0,
    -intensity,
    1 + intensity * 4,
    -intensity,
    0,
    -intensity,
    0
  ];
}

function buildTemperatureMatrix(temperature: number) {
  const shift = Math.round(temperature * 40);

  return [
    1,
    0,
    0,
    0,
    shift,
    0,
    1,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    -shift,
    0,
    0,
    0,
    1,
    0
  ];
}

function applyImageFilters(image: FabricImage, layer: ImageLayer) {
  const nextFilters = [];

  if (layer.filters.brightness !== 0) {
    nextFilters.push(
      new filters.Brightness({ brightness: layer.filters.brightness })
    );
  }

  if (layer.filters.contrast !== 0) {
    nextFilters.push(new filters.Contrast({ contrast: layer.filters.contrast }));
  }

  if (layer.filters.saturation !== 0) {
    nextFilters.push(
      new filters.Saturation({ saturation: layer.filters.saturation })
    );
  }

  if (layer.filters.blur !== 0) {
    nextFilters.push(new filters.Blur({ blur: layer.filters.blur }));
  }

  if (layer.filters.sharpen !== 0) {
    nextFilters.push(
      new filters.Convolute({
        matrix: buildSharpenMatrix(layer.filters.sharpen)
      })
    );
  }

  if (layer.filters.temperature !== 0) {
    nextFilters.push(
      new filters.ColorMatrix({
        matrix: buildTemperatureMatrix(layer.filters.temperature)
      })
    );
  }

  image.filters = nextFilters;
  image.applyFilters();
}

async function createImageObject(layer: ImageLayer) {
  if (layer.source === "pending-upload") {
    return createImagePlaceholder(layer);
  }

  const image = await FabricImage.fromURL(layer.source);

  image.set({
    width: layer.originalWidth,
    height: layer.originalHeight
  });
  applyImageFilters(image, layer);

  return image;
}

function createTextObject(layer: TextLayer) {
  const fill =
    layer.style.gradient.length >= 2
      ? new Gradient({
          type: "linear",
          gradientUnits: "percentage",
          coords: { x1: 0, y1: 0, x2: 1, y2: 1 },
          colorStops: [
            { offset: 0, color: layer.style.gradient[0] },
            { offset: 1, color: layer.style.gradient[1] }
          ]
        })
      : layer.style.fill;

  return new Textbox(layer.content, {
    width: 560,
    fontSize: layer.style.fontSize,
    fontFamily: layer.style.fontFamily,
    fontWeight: String(layer.style.fontWeight),
    fill,
    stroke: layer.style.stroke,
    strokeWidth: layer.style.strokeWidth,
    shadow: layer.style.shadow ? new Shadow(layer.style.shadow) : undefined,
    backgroundColor: layer.style.backgroundColor,
    lineHeight: 1.1
  });
}

function createDecorationObject(layer: DecorationLayer) {
  const width = layer.shape === "highlight" ? 300 : 240;
  const height = layer.shape === "ribbon" ? 86 : 120;
  const rx = layer.shape === "highlight" ? 30 : 22;

  return new Rect({
    width,
    height,
    rx,
    ry: rx,
    fill: layer.fill
  });
}

export async function seedCanvas(
  canvas: Canvas,
  document: EditorDocument,
  selectedLayerIds: string[],
  options: SeedCanvasOptions = {}
) {
  const { showSafeArea = true } = options;

  canvas.clear();
  canvas.setDimensions({
    width: document.canvas.width,
    height: document.canvas.height
  });
  canvas.backgroundColor = document.canvas.backgroundColor;

  const board = new Rect({
    left: 0,
    top: 0,
    width: document.canvas.width,
    height: document.canvas.height,
    fill: document.canvas.backgroundColor,
    selectable: false,
    evented: false
  });

  canvas.add(board);
  if (showSafeArea) {
    canvas.add(createSafeArea(document));
  }

  const sortedLayers = [...document.layers].sort((left, right) => left.zIndex - right.zIndex);

  for (const layer of sortedLayers) {
    if (!layer.visible) {
      continue;
    }

    let object: FabricObject;

    if (layer.type === "image") {
      object = await createImageObject(layer);
    } else if (layer.type === "text") {
      object = createTextObject(layer);
    } else {
      object = createDecorationObject(layer);
    }

    applyCommonProps(object, layer, selectedLayerIds.includes(layer.id));
    canvas.add(object);
  }

  canvas.requestRenderAll();
}
