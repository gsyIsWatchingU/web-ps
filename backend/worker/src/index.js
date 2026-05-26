import {
  hydrateStoredDocument,
  normalizeDocumentForCreate,
  normalizeDocumentForUpdate,
  validateEditorDocument
} from "./document.js";
import { inferFileExtension, isSupportedMimeType, readImageMetadata } from "./image-metadata.js";

const SCHEMA_STATEMENTS = [
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

let schemaInitializationPromise = null;

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

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

function withCors(response, corsHeaders) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function getPathname(request) {
  return new URL(request.url).pathname.replace(/\/+$/, "") || "/";
}

function getObjectProxyBaseURL(request, env) {
  const configured = env.PUBLIC_ASSET_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return new URL("/objects", request.url).toString().replace(/\/$/, "");
}

function createAssetId() {
  return `img_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hash}`;
}

async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function ensureDatabaseSchema(env) {
  if (!schemaInitializationPromise) {
    // Some environments are deployed before D1 migrations are applied.
    // Bootstrapping the schema here prevents save/load requests from failing hard.
    schemaInitializationPromise = env.DB.batch(
      SCHEMA_STATEMENTS.map((statement) => env.DB.prepare(statement))
    ).catch((error) => {
      schemaInitializationPromise = null;
      throw error;
    });
  }

  await schemaInitializationPromise;
}

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
  )
    .bind(document.id, document.version, document.name, JSON.stringify(document), now, now)
    .run();

  return json(
    {
      id: document.id,
      version: document.version
    },
    { status: 201 }
  );
}

async function handleGetDocument(documentId, env) {
  await ensureDatabaseSchema(env);

  const row = await env.DB.prepare(
    `
      SELECT id, version, document_json, updated_at
      FROM editor_documents
      WHERE id = ?
    `
  )
    .bind(documentId)
    .first();

  if (!row) {
    return errorResponse(404, "DOCUMENT_NOT_FOUND", "Document not found.");
  }

  return json(hydrateStoredDocument(row));
}

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
  )
    .bind(documentId)
    .first();

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
  )
    .bind(nextVersion, document.name, JSON.stringify(document), document.updatedAt, documentId, current.version)
    .run();

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
  const createdAt = new Date().toISOString();
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
  )
    .bind(
      assetId,
      storageKey,
      sourceUrl,
      file.type || null,
      file.size,
      dimensions.width,
      dimensions.height,
      hash,
      createdAt
    )
    .run();

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

async function handlePreviewRender() {
  return errorResponse(
    501,
    "RENDER_NOT_IMPLEMENTED",
    "Server-side preview rendering is not implemented in the Cloudflare Worker phase."
  );
}

export default {
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
