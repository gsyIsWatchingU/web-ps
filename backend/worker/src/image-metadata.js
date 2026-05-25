const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SOI = [0xff, 0xd8];
const GIF87A = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89A = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function matchesSignature(bytes, signature, offset = 0) {
  return signature.every((part, index) => bytes[offset + index] === part);
}

function readUint16BE(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes, offset) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function parsePng(bytes) {
  if (!matchesSignature(bytes, PNG_SIGNATURE)) {
    return null;
  }

  return {
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20)
  };
}

function parseGif(bytes) {
  if (!matchesSignature(bytes, GIF87A) && !matchesSignature(bytes, GIF89A)) {
    return null;
  }

  return {
    width: readUint16LE(bytes, 6),
    height: readUint16LE(bytes, 8)
  };
}

function parseJpeg(bytes) {
  if (!matchesSignature(bytes, JPEG_SOI)) {
    return null;
  }

  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (!marker || marker === 0xd9 || marker === 0xda) {
      break;
    }

    const size = readUint16BE(bytes, offset + 2);
    const isFrameMarker =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isFrameMarker) {
      return {
        width: readUint16BE(bytes, offset + 7),
        height: readUint16BE(bytes, offset + 5)
      };
    }

    offset += 2 + size;
  }

  return null;
}

function parseWebp(bytes) {
  if (!matchesSignature(bytes, RIFF) || !matchesSignature(bytes, WEBP, 8)) {
    return null;
  }

  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (chunkType === "VP8X") {
    return {
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1
    };
  }

  if (chunkType === "VP8L") {
    const bits =
      bytes[21] |
      (bytes[22] << 8) |
      (bytes[23] << 16) |
      (bytes[24] << 24);

    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }

  if (chunkType === "VP8 ") {
    return {
      width: readUint16LE(bytes, 26) & 0x3fff,
      height: readUint16LE(bytes, 28) & 0x3fff
    };
  }

  return null;
}

export function inferFileExtension(mimeType, originalName = "") {
  const normalized = String(mimeType || "").toLowerCase();
  const name = originalName.toLowerCase();

  if (normalized === "image/png" || name.endsWith(".png")) {
    return "png";
  }

  if (normalized === "image/jpeg" || normalized === "image/jpg" || name.endsWith(".jpeg") || name.endsWith(".jpg")) {
    return "jpg";
  }

  if (normalized === "image/webp" || name.endsWith(".webp")) {
    return "webp";
  }

  if (normalized === "image/gif" || name.endsWith(".gif")) {
    return "gif";
  }

  return null;
}

export function isSupportedMimeType(mimeType) {
  return ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"].includes(
    String(mimeType || "").toLowerCase()
  );
}

export function readImageMetadata(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  const metadata = parsePng(bytes) ?? parseJpeg(bytes) ?? parseGif(bytes) ?? parseWebp(bytes);
  if (!metadata || metadata.width <= 0 || metadata.height <= 0) {
    throw new Error("Unable to read image dimensions.");
  }

  return metadata;
}
