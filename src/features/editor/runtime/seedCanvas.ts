import {
  Canvas,
  FabricImage,
  Gradient,
  Path,
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
import { renderProcessedImageSource } from "./lutEngine";

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

function applyCommonProps(object: FabricObject, layer: EditorLayer, isSelected: boolean, preservePosition = false) {
  const props: Record<string, unknown> = {
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
  };

  if (!preservePosition) {
    props.left = layer.transform.x;
    props.top = layer.transform.y;
  }

  object.set(props);

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

function applyImageFilters(image: FabricImage, layer: ImageLayer) {
  const nextFilters = [];

  if (layer.filters.blur !== 0) {
    nextFilters.push(new filters.Blur({ blur: layer.filters.blur }));
  }

  if (layer.filters.sharpen !== 0) {
    nextFilters.push(new filters.Convolute({ matrix: buildSharpenMatrix(layer.filters.sharpen) }));
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

  const processedSource = await renderProcessedImageSource(layer);
  const image = await FabricImage.fromURL(processedSource);
  const previewingCurrentLayer = cropPreview && cropPreview.layerId === layer.id;

  if (previewingCurrentLayer) {
    image.set({
      cropX: 0,
      cropY: 0,
      width: layer.originalWidth,
      height: layer.originalHeight,
      left: layer.transform.x - layer.crop.x * layer.transform.scaleX,
      top: layer.transform.y - layer.crop.y * layer.transform.scaleY
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
  if (layer.decorationKind === "sticker") {
    const stickerMap: Record<DecorationLayer["sticker"], string> = {
      star: "🌟",
      ribbon: "🎀",
      bear: "🐻",
      strawberry: "🍓",
      sparkle: "✨"
    };

    return new Textbox(stickerMap[layer.sticker], {
      width: layer.width,
      height: layer.height,
      fontSize: Math.round(Math.min(layer.width, layer.height) * 0.78),
      fontFamily: "\"Segoe UI Emoji\", \"Apple Color Emoji\", sans-serif",
      textAlign: "center",
      fill: "#1c2520"
    });
  }

  if (layer.shape === "heart") {
    const heart = new Path(
      "M 50 90 C 20 70 0 45 0 20 C 0 -8 22 -24 46 -24 C 64 -24 80 -14 90 2 C 100 -14 116 -24 134 -24 C 158 -24 180 -8 180 20 C 180 45 160 70 130 90 L 90 126 Z",
      {
        fill: layer.fill
      }
    );

    const heartWidth = heart.width ?? 180;
    const heartHeight = heart.height ?? 150;

    heart.set({
      scaleX: layer.width / heartWidth,
      scaleY: layer.height / heartHeight
    });

    return heart;
  }

  return new Rect({
    width: layer.width,
    height: layer.height,
    rx: layer.shape === "circle" ? layer.width / 2 : 24,
    ry: layer.shape === "circle" ? layer.height / 2 : 24,
    fill: layer.fill
  });
}

function createDoodleObject(layer: DoodleLayer) {
  const polyline = new Polyline(layer.points, {
    fill: "",
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    objectCaching: false
  });
  
  polyline.set({
    left: layer.transform.x,
    top: layer.transform.y
  });
  
  return polyline;
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
    const isCropPreviewImage = layer.type === "image" && !!cropPreview && cropPreview.layerId === layer.id;

    if (layer.type === "image") {
      object = await createImageObject(layer, cropPreview);
    } else if (layer.type === "text") {
      object = createTextObject(layer);
    } else if (layer.type === "doodle") {
      object = createDoodleObject(layer);
    } else {
      object = createDecorationObject(layer);
    }

    applyCommonProps(object, layer, selectedLayerIds.includes(layer.id), isCropPreviewImage);
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
