var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/document.js
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
__name(isRecord, "isRecord");
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
__name(isNonEmptyString, "isNonEmptyString");
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}
__name(isPositiveInteger, "isPositiveInteger");
function createServerDocumentId() {
  return `doc_srv_${crypto.randomUUID().replace(/-/g, "")}`;
}
__name(createServerDocumentId, "createServerDocumentId");
function isTemporaryDocumentId(value) {
  return !isNonEmptyString(value) || value.startsWith("doc-") || value.startsWith("template-");
}
__name(isTemporaryDocumentId, "isTemporaryDocumentId");
function validateEditorDocument(value) {
  if (!isRecord(value)) {
    return { ok: false, message: "Body must be a JSON object." };
  }
  if (!isNonEmptyString(value.id)) {
    return { ok: false, message: "Document id is required." };
  }
  if (!isPositiveInteger(value.version)) {
    return { ok: false, message: "Document version must be a positive integer." };
  }
  if (!isNonEmptyString(value.name)) {
    return { ok: false, message: "Document name is required." };
  }
  if (!isRecord(value.canvas)) {
    return { ok: false, message: "Document canvas is required." };
  }
  if (!Array.isArray(value.layers)) {
    return { ok: false, message: "Document layers must be an array." };
  }
  if (!isRecord(value.exportConfig)) {
    return { ok: false, message: "Document exportConfig is required." };
  }
  if (!isRecord(value.draftMeta)) {
    return { ok: false, message: "Document draftMeta is required." };
  }
  if (!isRecord(value.workflowMeta)) {
    return { ok: false, message: "Document workflowMeta is required." };
  }
  if (!isNonEmptyString(value.updatedAt)) {
    return { ok: false, message: "Document updatedAt is required." };
  }
  if (value.renderRequest !== void 0 && !isRecord(value.renderRequest)) {
    return { ok: false, message: "renderRequest must be an object when present." };
  }
  if (value.assetRegistry !== void 0 && !isRecord(value.assetRegistry)) {
    return { ok: false, message: "assetRegistry must be an object when present." };
  }
  return { ok: true, document: value };
}
__name(validateEditorDocument, "validateEditorDocument");
function normalizeDocumentForCreate(document) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const id = isTemporaryDocumentId(document.id) ? createServerDocumentId() : document.id;
  return {
    ...document,
    id,
    version: 1,
    updatedAt: now
  };
}
__name(normalizeDocumentForCreate, "normalizeDocumentForCreate");
function normalizeDocumentForUpdate(document, documentId, nextVersion) {
  return {
    ...document,
    id: documentId,
    version: nextVersion,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(normalizeDocumentForUpdate, "normalizeDocumentForUpdate");
function hydrateStoredDocument(row) {
  const parsed = JSON.parse(row.document_json);
  return {
    ...parsed,
    id: row.id,
    version: row.version,
    updatedAt: row.updated_at
  };
}
__name(hydrateStoredDocument, "hydrateStoredDocument");

// src/image-metadata.js
var PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
var JPEG_SOI = [255, 216];
var GIF87A = [71, 73, 70, 56, 55, 97];
var GIF89A = [71, 73, 70, 56, 57, 97];
var RIFF = [82, 73, 70, 70];
var WEBP = [87, 69, 66, 80];
function matchesSignature(bytes, signature, offset = 0) {
  return signature.every((part, index) => bytes[offset + index] === part);
}
__name(matchesSignature, "matchesSignature");
function readUint16BE(bytes, offset) {
  return bytes[offset] << 8 | bytes[offset + 1];
}
__name(readUint16BE, "readUint16BE");
function readUint16LE(bytes, offset) {
  return bytes[offset] | bytes[offset + 1] << 8;
}
__name(readUint16LE, "readUint16LE");
function readUint24LE(bytes, offset) {
  return bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16;
}
__name(readUint24LE, "readUint24LE");
function readUint32BE(bytes, offset) {
  return (bytes[offset] << 24 | bytes[offset + 1] << 16 | bytes[offset + 2] << 8 | bytes[offset + 3]) >>> 0;
}
__name(readUint32BE, "readUint32BE");
function parsePng(bytes) {
  if (!matchesSignature(bytes, PNG_SIGNATURE)) {
    return null;
  }
  return {
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20)
  };
}
__name(parsePng, "parsePng");
function parseGif(bytes) {
  if (!matchesSignature(bytes, GIF87A) && !matchesSignature(bytes, GIF89A)) {
    return null;
  }
  return {
    width: readUint16LE(bytes, 6),
    height: readUint16LE(bytes, 8)
  };
}
__name(parseGif, "parseGif");
function parseJpeg(bytes) {
  if (!matchesSignature(bytes, JPEG_SOI)) {
    return null;
  }
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 255) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (!marker || marker === 217 || marker === 218) {
      break;
    }
    const size = readUint16BE(bytes, offset + 2);
    const isFrameMarker = marker >= 192 && marker <= 195 || marker >= 197 && marker <= 199 || marker >= 201 && marker <= 203 || marker >= 205 && marker <= 207;
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
__name(parseJpeg, "parseJpeg");
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
    const bits = bytes[21] | bytes[22] << 8 | bytes[23] << 16 | bytes[24] << 24;
    return {
      width: (bits & 16383) + 1,
      height: (bits >> 14 & 16383) + 1
    };
  }
  if (chunkType === "VP8 ") {
    return {
      width: readUint16LE(bytes, 26) & 16383,
      height: readUint16LE(bytes, 28) & 16383
    };
  }
  return null;
}
__name(parseWebp, "parseWebp");
function inferFileExtension(mimeType, originalName = "") {
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
__name(inferFileExtension, "inferFileExtension");
function isSupportedMimeType(mimeType) {
  return ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"].includes(
    String(mimeType || "").toLowerCase()
  );
}
__name(isSupportedMimeType, "isSupportedMimeType");
function readImageMetadata(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const metadata = parsePng(bytes) ?? parseJpeg(bytes) ?? parseGif(bytes) ?? parseWebp(bytes);
  if (!metadata || metadata.width <= 0 || metadata.height <= 0) {
    throw new Error("Unable to read image dimensions.");
  }
  return metadata;
}
__name(readImageMetadata, "readImageMetadata");

// src/index.js
var SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS editor_documents (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    name TEXT NOT NULL,
    document_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_rendered_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS image_assets (
    asset_id TEXT PRIMARY KEY,
    storage_key TEXT NOT NULL,
    source_url TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    sha256_hash TEXT,
    created_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_editor_documents_updated_at ON editor_documents(updated_at)",
  "CREATE INDEX IF NOT EXISTS idx_image_assets_created_at ON image_assets(created_at)"
];
var schemaInitializationPromise = null;
function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}
__name(json, "json");
function errorResponse(status, code, message, extra = {}) {
  return json(
    {
      error: {
        code,
        message,
        ...extra
      }
    },
    { status }
  );
}
__name(errorResponse, "errorResponse");
function buildCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = env.CORS_ORIGIN?.trim() || "*";
  const responseOrigin = allowedOrigin === "*" ? "*" : origin && origin === allowedOrigin ? origin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": responseOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,If-Match",
    "Access-Control-Max-Age": "86400"
  };
}
__name(buildCorsHeaders, "buildCorsHeaders");
function withCors(response, corsHeaders) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withCors, "withCors");
function getPathname(request) {
  return new URL(request.url).pathname.replace(/\/+$/, "") || "/";
}
__name(getPathname, "getPathname");
function getObjectProxyBaseURL(request, env) {
  const configured = env.PUBLIC_ASSET_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return new URL("/objects", request.url).toString().replace(/\/$/, "");
}
__name(getObjectProxyBaseURL, "getObjectProxyBaseURL");
function createAssetId() {
  return `img_${crypto.randomUUID().replace(/-/g, "")}`;
}
__name(createAssetId, "createAssetId");
async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hash}`;
}
__name(sha256Hex, "sha256Hex");
async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(parseJsonBody, "parseJsonBody");
async function ensureDatabaseSchema(env) {
  if (!schemaInitializationPromise) {
    schemaInitializationPromise = env.DB.batch(
      SCHEMA_STATEMENTS.map((statement) => env.DB.prepare(statement))
    ).catch((error) => {
      schemaInitializationPromise = null;
      throw error;
    });
  }
  await schemaInitializationPromise;
}
__name(ensureDatabaseSchema, "ensureDatabaseSchema");
async function handleCreateDocument(request, env) {
  await ensureDatabaseSchema(env);
  const body = await parseJsonBody(request);
  if (!body) {
    return errorResponse(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const validation = validateEditorDocument(body);
  if (!validation.ok) {
    return errorResponse(400, "VALIDATION_ERROR", validation.message);
  }
  const document = normalizeDocumentForCreate(validation.document);
  const now = document.updatedAt;
  await env.DB.prepare(
    `
      INSERT INTO editor_documents (id, version, name, document_json, created_at, updated_at, last_rendered_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `
  ).bind(document.id, document.version, document.name, JSON.stringify(document), now, now).run();
  return json(
    {
      id: document.id,
      version: document.version
    },
    { status: 201 }
  );
}
__name(handleCreateDocument, "handleCreateDocument");
async function handleGetDocument(documentId, env) {
  await ensureDatabaseSchema(env);
  const row = await env.DB.prepare(
    `
      SELECT id, version, document_json, updated_at
      FROM editor_documents
      WHERE id = ?
    `
  ).bind(documentId).first();
  if (!row) {
    return errorResponse(404, "DOCUMENT_NOT_FOUND", "Document not found.");
  }
  return json(hydrateStoredDocument(row));
}
__name(handleGetDocument, "handleGetDocument");
async function handleUpdateDocument(request, env, documentId) {
  await ensureDatabaseSchema(env);
  const body = await parseJsonBody(request);
  if (!body) {
    return errorResponse(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const validation = validateEditorDocument(body);
  if (!validation.ok) {
    return errorResponse(400, "VALIDATION_ERROR", validation.message);
  }
  const current = await env.DB.prepare(
    `
      SELECT id, version
      FROM editor_documents
      WHERE id = ?
    `
  ).bind(documentId).first();
  if (!current) {
    return errorResponse(404, "DOCUMENT_NOT_FOUND", "Document not found.");
  }
  if (validation.document.version !== current.version) {
    return errorResponse(409, "DOCUMENT_VERSION_CONFLICT", "Document version is stale.", {
      currentVersion: current.version
    });
  }
  const nextVersion = current.version + 1;
  const document = normalizeDocumentForUpdate(validation.document, documentId, nextVersion);
  const result = await env.DB.prepare(
    `
      UPDATE editor_documents
      SET version = ?, name = ?, document_json = ?, updated_at = ?
      WHERE id = ? AND version = ?
    `
  ).bind(nextVersion, document.name, JSON.stringify(document), document.updatedAt, documentId, current.version).run();
  if (!result.meta?.changes) {
    return errorResponse(409, "DOCUMENT_VERSION_CONFLICT", "Document version is stale.", {
      currentVersion: current.version
    });
  }
  return json({
    id: documentId,
    version: nextVersion
  });
}
__name(handleUpdateDocument, "handleUpdateDocument");
async function handleUploadImage(request, env) {
  await ensureDatabaseSchema(env);
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse(400, "VALIDATION_ERROR", "A file field is required.");
  }
  if (!isSupportedMimeType(file.type)) {
    return errorResponse(415, "ASSET_UPLOAD_FAILED", "Unsupported image mime type.");
  }
  const ext = inferFileExtension(file.type, file.name);
  if (!ext) {
    return errorResponse(415, "ASSET_UPLOAD_FAILED", "Unable to infer file extension.");
  }
  const arrayBuffer = await file.arrayBuffer();
  let dimensions;
  try {
    dimensions = readImageMetadata(arrayBuffer);
  } catch {
    return errorResponse(422, "ASSET_UPLOAD_FAILED", "Unable to read image dimensions.");
  }
  const assetId = createAssetId();
  const storageKey = `editor-assets/${assetId}/original.${ext}`;
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const hash = await sha256Hex(arrayBuffer);
  const sourceUrl = `${getObjectProxyBaseURL(request, env)}/${storageKey}`;
  await env.ASSETS_BUCKET.put(storageKey, arrayBuffer, {
    httpMetadata: {
      contentType: file.type
    }
  });
  await env.DB.prepare(
    `
      INSERT INTO image_assets (
        asset_id,
        storage_key,
        source_url,
        mime_type,
        size_bytes,
        width,
        height,
        sha256_hash,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).bind(
    assetId,
    storageKey,
    sourceUrl,
    file.type || null,
    file.size,
    dimensions.width,
    dimensions.height,
    hash,
    createdAt
  ).run();
  return json(
    {
      assetId,
      sourceUrl,
      width: dimensions.width,
      height: dimensions.height,
      mimeType: file.type || null,
      sizeBytes: file.size,
      hash,
      createdAt
    },
    { status: 201 }
  );
}
__name(handleUploadImage, "handleUploadImage");
async function handleObjectRead(request, env, pathname) {
  const key = pathname.replace(/^\/objects\//, "");
  if (!key) {
    return errorResponse(404, "ASSET_NOT_FOUND", "Asset not found.");
  }
  const object = await env.ASSETS_BUCKET.get(key);
  if (!object) {
    return errorResponse(404, "ASSET_NOT_FOUND", "Asset not found.");
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, {
    status: 200,
    headers
  });
}
__name(handleObjectRead, "handleObjectRead");
async function handlePreviewRender() {
  return errorResponse(
    501,
    "RENDER_NOT_IMPLEMENTED",
    "Server-side preview rendering is not implemented in the Cloudflare Worker phase."
  );
}
__name(handlePreviewRender, "handlePreviewRender");
var src_default = {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), corsHeaders);
    }
    try {
      const pathname = getPathname(request);
      let response;
      if (request.method === "POST" && pathname === "/documents") {
        response = await handleCreateDocument(request, env);
      } else if (request.method === "GET" && pathname.startsWith("/documents/")) {
        response = await handleGetDocument(decodeURIComponent(pathname.slice("/documents/".length)), env);
      } else if (request.method === "PUT" && pathname.startsWith("/documents/")) {
        response = await handleUpdateDocument(
          request,
          env,
          decodeURIComponent(pathname.slice("/documents/".length))
        );
      } else if (request.method === "POST" && pathname === "/assets/images") {
        response = await handleUploadImage(request, env);
      } else if (request.method === "GET" && pathname.startsWith("/objects/")) {
        response = await handleObjectRead(request, env, pathname);
      } else if (request.method === "POST" && pathname === "/renders/preview") {
        response = await handlePreviewRender();
      } else {
        response = errorResponse(404, "NOT_FOUND", "Route not found.");
      }
      return withCors(response, corsHeaders);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected internal error.";
      return withCors(errorResponse(500, "INTERNAL_ERROR", message), corsHeaders);
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-tfvuKy/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-tfvuKy/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
