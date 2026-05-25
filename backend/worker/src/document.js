function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function createServerDocumentId() {
  return `doc_srv_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function isTemporaryDocumentId(value) {
  return !isNonEmptyString(value) || value.startsWith("doc-") || value.startsWith("template-");
}

export function validateEditorDocument(value) {
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

  if (value.renderRequest !== undefined && !isRecord(value.renderRequest)) {
    return { ok: false, message: "renderRequest must be an object when present." };
  }

  if (value.assetRegistry !== undefined && !isRecord(value.assetRegistry)) {
    return { ok: false, message: "assetRegistry must be an object when present." };
  }

  return { ok: true, document: value };
}

export function normalizeDocumentForCreate(document) {
  const now = new Date().toISOString();
  const id = isTemporaryDocumentId(document.id) ? createServerDocumentId() : document.id;

  return {
    ...document,
    id,
    version: 1,
    updatedAt: now
  };
}

export function normalizeDocumentForUpdate(document, documentId, nextVersion) {
  return {
    ...document,
    id: documentId,
    version: nextVersion,
    updatedAt: new Date().toISOString()
  };
}

export function hydrateStoredDocument(row) {
  const parsed = JSON.parse(row.document_json);

  return {
    ...parsed,
    id: row.id,
    version: row.version,
    updatedAt: row.updated_at
  };
}
