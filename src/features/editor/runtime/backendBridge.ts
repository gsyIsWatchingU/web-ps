import type {
  EditorDocument,
  ImageAsset,
  RenderRequest,
  RenderResult
} from "../model/document";

const backendConfig = {
  baseURL: import.meta.env.VITE_EDITOR_API_BASE_URL?.trim() || "",
  previewEndpoint: import.meta.env.VITE_EDITOR_PREVIEW_ENDPOINT?.trim() || "/renders/preview"
};

type UploadImageResponse = {
  assetId?: string;
  asset_id?: string;
  url?: string;
  sourceUrl?: string;
  source_url?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  mime_type?: string;
  sizeBytes?: number;
  size_bytes?: number;
  hash?: string;
  createdAt?: string;
  created_at?: string;
};

type SaveDocumentResponse = {
  id?: string;
  documentId?: string;
  document_id?: string;
  version?: number;
};

type RenderPreviewResponse = {
  documentId?: string;
  document_id?: string;
  version?: number;
  format?: RenderRequest["format"];
  width?: number;
  height?: number;
  previewUrl?: string;
  preview_url?: string;
  downloadUrl?: string;
  download_url?: string;
};

function normalizeBaseURL() {
  return backendConfig.baseURL.replace(/\/$/, "");
}

export function hasBackendConfig() {
  return Boolean(normalizeBaseURL());
}

function buildEndpoint(path: string) {
  return `${normalizeBaseURL()}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function uploadImageAsset(file: File): Promise<ImageAsset | null> {
  if (!hasBackendConfig()) {
    return null;
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(buildEndpoint("/assets/images"), {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Failed to upload source image: ${response.status}`);
  }

  const payload = (await response.json()) as UploadImageResponse;
  const assetId = payload.assetId ?? payload.asset_id;
  const sourceUrl = payload.sourceUrl ?? payload.source_url ?? payload.url;

  if (!assetId || !sourceUrl) {
    throw new Error("Image upload succeeded without an asset id or source url.");
  }

  return {
    assetId,
    sourceUrl,
    originalWidth: payload.width ?? 0,
    originalHeight: payload.height ?? 0,
    mimeType: payload.mimeType ?? payload.mime_type ?? (file.type || null),
    sizeBytes: payload.sizeBytes ?? payload.size_bytes ?? (file.size || null),
    hash: payload.hash ?? null,
    createdAt: payload.createdAt ?? payload.created_at ?? new Date().toISOString()
  };
}

export async function saveEditorDocument(document: EditorDocument): Promise<Pick<EditorDocument, "id" | "version"> | null> {
  if (!hasBackendConfig()) {
    return null;
  }

  const isCreate = !document.id || document.id.startsWith("doc-") || document.id.startsWith("template-");
  const endpoint = isCreate ? buildEndpoint("/documents") : buildEndpoint(`/documents/${document.id}`);
  const method = isCreate ? "POST" : "PUT";

  const response = await fetch(endpoint, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(document)
  });

  if (!response.ok) {
    throw new Error(`Failed to save document: ${response.status}`);
  }

  const payload = (await response.json()) as SaveDocumentResponse;

  return {
    id: payload.id ?? payload.documentId ?? payload.document_id ?? document.id,
    version: payload.version ?? document.version
  };
}

export async function requestRenderPreview(document: EditorDocument): Promise<RenderResult | null> {
  if (!hasBackendConfig()) {
    return null;
  }

  const response = await fetch(buildEndpoint(backendConfig.previewEndpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      documentId: document.id,
      version: document.version,
      renderRequest: document.renderRequest,
      document
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to render preview: ${response.status}`);
  }

  const payload = (await response.json()) as RenderPreviewResponse;

  return {
    documentId: payload.documentId ?? payload.document_id ?? document.id,
    version: payload.version ?? document.version,
    format: payload.format ?? document.renderRequest.format,
    width: payload.width ?? document.renderRequest.width,
    height: payload.height ?? document.renderRequest.height,
    previewUrl: payload.previewUrl ?? payload.preview_url ?? null,
    downloadUrl: payload.downloadUrl ?? payload.download_url ?? null
  };
}
