CREATE TABLE IF NOT EXISTS editor_documents (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  document_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_rendered_at TEXT
);

CREATE TABLE IF NOT EXISTS image_assets (
  asset_id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL,
  source_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  sha256_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_editor_documents_updated_at
ON editor_documents(updated_at);

CREATE INDEX IF NOT EXISTS idx_image_assets_created_at
ON image_assets(created_at);
