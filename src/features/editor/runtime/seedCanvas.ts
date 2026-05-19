import {
  Canvas,
  FabricImage,
  Gradient,
  Polyline,
  Rect,
  Shadow,
  Textbox,
  filters,
  type FabricObject
} from "fabric";
import type {
  DecorationLayer,
  DoodleLayer,
  EditorDocument,
  EditorLayer,
  ImageCrop,
  ImageLayer,
  TextLayer
} from "../model/document";

type SeedCanvasOptions = {
  showSafeArea?: boolean;
  renderCanvasBackground?: boolean;
  cropPreview?: {
    layerId: string;
    draft: ImageCrop;
  } | null;
};

type LayerObject = FabricObject & {
  data?: {
    layerId?: string;
  };
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

  (object as LayerObject).data = {
    ...(object as LayerObject).data,
    layerId: layer.id
  };

  if (isSelected) {
    object.set({
      borderColor: "#cd5c2d",
      cornerColor: "#cd5c2d",
      cornerStrokeColor: "#fffaf3"
    });
  }
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
  const width = layer.crop.width;
  const height = layer.crop.height;

  return new Textbox("导入图片后开始编辑", {
    left: layer.transform.x,
    top: layer.transform.y,
    width: Math.max(width, 220),
    fontSize: 28,
    fill: "#5b6a61",
    fontFamily: "Avenir Next",
    fontWeight: 600
  });
}

function buildSharpenMatrix(intensity: number) {
  return [0, -intensity, 0, -intensity, 1 + intensity * 4, -intensity, 0, -intensity, 0];
}

function buildTemperatureMatrix(temperature: number) {
  const redShift = Math.round(temperature * 24);
  const greenShift = Math.round(temperature * 6);
  const blueShift = Math.round(temperature * -18);

  return [1, 0, 0, 0, redShift, 0, 1, 0, 0, greenShift, 0, 0, 1, 0, blueShift, 0, 0, 0, 1, 0];
}

function applyImageFilters(image: FabricImage, layer: ImageLayer) {
  const nextFilters = [];

  if (layer.filters.brightness !== 0) {
    nextFilters.push(new filters.Brightness({ brightness: layer.filters.brightness }));
  }

  if (layer.filters.contrast !== 0) {
    nextFilters.push(new filters.Contrast({ contrast: layer.filters.contrast }));
  }

  if (layer.filters.saturation !== 0) {
    nextFilters.push(new filters.Saturation({ saturation: layer.filters.saturation }));
  }

  if (layer.filters.vibrance !== 0) {
    nextFilters.push(new filters.Vibrance({ vibrance: layer.filters.vibrance }));
  }

  if (layer.filters.blur !== 0) {
    nextFilters.push(new filters.Blur({ blur: layer.filters.blur }));
  }

  if (layer.filters.sharpen !== 0) {
    nextFilters.push(new filters.Convolute({ matrix: buildSharpenMatrix(layer.filters.sharpen) }));
  }

  if (layer.filters.temperature !== 0) {
    nextFilters.push(new filters.ColorMatrix({ matrix: buildTemperatureMatrix(layer.filters.temperature) }));
  }

  if (layer.filters.hue !== 0) {
    nextFilters.push(new filters.HueRotation({ rotation: layer.filters.hue }));
  }

  image.filters = nextFilters;
  image.applyFilters();
}

async function createImageObject(
  layer: ImageLayer,
  cropPreview?: SeedCanvasOptions["cropPreview"]
) {
  if (layer.source === "pending-upload") {
    return createImagePlaceholder(layer);
  }

  const image = await FabricImage.fromURL(layer.source);
  const previewingCurrentLayer = cropPreview && cropPreview.layerId === layer.id;

  if (previewingCurrentLayer) {
    image.set({
      cropX: 0,
      cropY: 0,
      width: layer.originalWidth,
      height: layer.originalHeight
    });
  } else {
    image.set({
      cropX: layer.crop.x,
      cropY: layer.crop.y,
      width: layer.crop.width,
      height: layer.crop.height
    });
  }

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

function createDoodleObject(layer: DoodleLayer) {
  return new Polyline(layer.points, {
    fill: "",
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    objectCaching: false
  });
}

export async function seedCanvas(
  canvas: Canvas,
  document: EditorDocument,
  selectedLayerIds: string[],
  options: SeedCanvasOptions = {}
) {
  const { showSafeArea = true, renderCanvasBackground = true, cropPreview = null } = options;

  canvas.clear();
  canvas.setDimensions({
    width: document.canvas.width,
    height: document.canvas.height
  });
  canvas.backgroundColor = renderCanvasBackground ? document.canvas.backgroundColor : "transparent";

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
      object = await createImageObject(layer, cropPreview);
    } else if (layer.type === "text") {
      object = createTextObject(layer);
    } else if (layer.type === "doodle") {
      object = createDoodleObject(layer);
    } else {
      object = createDecorationObject(layer);
    }

    applyCommonProps(object, layer, selectedLayerIds.includes(layer.id));
    canvas.add(object);
  }

  const activeLayerId = selectedLayerIds[0];

  if (activeLayerId) {
    const activeObject = canvas
      .getObjects()
      .find((object) => (object as LayerObject).data?.layerId === activeLayerId);

    if (activeObject) {
      canvas.setActiveObject(activeObject);
    }
  }

  canvas.requestRenderAll();
}
