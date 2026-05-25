# Editor Backend Implementation Checklist

## Summary

This checklist breaks the 5 required backend endpoints into 3 implementation tracks:

- Database tables
- Object storage
- Render service

The goal is to make the backend work parallelizable across engineers while keeping the phase-2 scope minimal.

Related docs:

- [Backend API Contract](./backend-api-contract.md)
- [Editor MVP Design](./design.md)

## Scope

This checklist covers the backend work needed for:

- `POST /assets/images`
- `GET /documents/:id`
- `POST /documents`
- `PUT /documents/:id`
- `POST /renders/preview`

It does not cover:

- Document list APIs
- Auth and sharing
- AI image edit backendization
- Final production-grade export pipeline
- Multi-user collaboration

## Delivery Split

### Track A. Database

Owner suggestion: backend application engineer

Covers:

- `GET /documents/:id`
- `POST /documents`
- `PUT /documents/:id`
- Metadata persistence for uploaded assets

### Track B. Object Storage

Owner suggestion: infrastructure or backend engineer

Covers:

- Original image binary upload
- Stable public or signed read URLs for assets
- Optional preview render output storage

### Track C. Render Service

Owner suggestion: image-processing or backend engineer

Covers:

- `POST /renders/preview`
- Server-side document-to-image rendering
- Image asset lookup and composition

## Track A. Database Tasks

### A1. Create `editor_documents` table

Purpose:

- Persist the full editor document snapshot
- Support create, read, update, and optimistic concurrency

Recommended columns:

```sql
id                varchar primary key
version           integer not null
name              varchar not null
document_json     jsonb not null
created_at        timestamptz not null
updated_at        timestamptz not null
last_rendered_at  timestamptz null
```

Notes:

- `document_json` stores the full `EditorDocument`
- `name` is duplicated for query/debug convenience
- `version` is the optimistic concurrency source of truth

Acceptance:

- Can insert a new full document snapshot
- Can fetch the document by `id`
- Can update only when incoming version matches current version policy

### A2. Create `image_assets` table

Purpose:

- Persist metadata for uploaded original images
- Provide a lookup source for `assetRegistry`

Recommended columns:

```sql
asset_id          varchar primary key
storage_key       varchar not null
source_url        text not null
mime_type         varchar null
size_bytes        bigint null
width             integer not null
height            integer not null
sha256_hash       varchar null
created_at        timestamptz not null
```

Acceptance:

- Every successful upload produces one `image_assets` row
- Metadata returned by `POST /assets/images` matches persisted values

### A3. Define create-document flow

Flow:

1. Accept full `EditorDocument`
2. Generate canonical server document id if incoming id is temporary
3. Normalize server `version` to `1`
4. Store full document snapshot in `editor_documents`
5. Return `{ id, version }`

Implementation notes:

- Treat incoming `doc-*` and `template-*` ids as temporary client ids
- Prefer canonical server ids like `doc_srv_<unique>`

Acceptance:

- `POST /documents` returns stable server `id`
- Stored document snapshot is retrievable unchanged by `GET /documents/:id`

### A4. Define update-document flow

Flow:

1. Accept full `EditorDocument`
2. Load current database row by `id`
3. Compare incoming document version with stored version
4. Reject on stale version with `409` or `412`
5. On success, increment version and update stored snapshot
6. Return `{ id, version }`

Recommended version policy:

- Incoming request carries current client version
- Database row stores current server version
- Update succeeds only when `incoming.version == stored.version`
- Persisted new version becomes `stored.version + 1`

Acceptance:

- Matching version updates successfully
- Stale version returns conflict status and does not overwrite data

### A5. Define document read flow

Flow:

1. Load row from `editor_documents`
2. Return `document_json`
3. Ensure returned body still includes latest `id`, `version`, `updatedAt`

Acceptance:

- `GET /documents/:id` returns the full stored `EditorDocument`
- Missing document returns `404`

### A6. Optional but recommended: create `render_jobs` table

Purpose:

- Track preview render execution for debugging and observability

Recommended columns:

```sql
id               varchar primary key
document_id      varchar not null
document_version integer not null
render_request   jsonb not null
status           varchar not null
preview_url      text null
download_url     text null
error_message    text null
created_at       timestamptz not null
updated_at       timestamptz not null
```

This table is optional in phase 2 because `/renders/preview` can be synchronous.

## Track B. Object Storage Tasks

### B1. Provision original asset bucket or container

Purpose:

- Store original uploaded images from `POST /assets/images`

Recommended path layout:

```text
editor-assets/{assetId}/original.{ext}
```

Acceptance:

- Backend can write image bytes to object storage
- Backend can generate a stable `sourceUrl`

### B2. Implement upload pipeline for `POST /assets/images`

Flow:

1. Accept multipart file
2. Validate file exists and is an image
3. Generate `assetId`
4. Read image dimensions
5. Compute optional content hash
6. Upload original bytes to storage
7. Persist metadata to `image_assets`
8. Return metadata JSON

Validation rules:

- Reject missing file with `400`
- Reject unsupported mime type with `415` or `400`
- Reject unreadable image with `422`

Acceptance:

- Returned `sourceUrl` is fetchable by the frontend
- Width and height are correct
- Metadata persists in database

### B3. Decide URL strategy

Choose one:

- Public CDN URL
- Signed URL with sufficient TTL
- Reverse-proxy application URL

Recommendation for phase 2:

- Use stable CDN or reverse-proxy URL so the frontend can immediately display and re-open images without short-lived signed URL expiry issues

Acceptance:

- `sourceUrl` remains valid across page refresh and document reopen

### B4. Provision render output bucket

Purpose:

- Store preview render results from `/renders/preview`

Recommended path layout:

```text
editor-renders/{documentId}/v{version}/preview.{ext}
editor-renders/{documentId}/v{version}/download.{ext}
```

Acceptance:

- Render service can write preview outputs
- Backend can return `previewUrl` and optional `downloadUrl`

## Track C. Render Service Tasks

### C1. Build render input adapter

Purpose:

- Convert the incoming preview request into a renderable internal scene

Input:

- `documentId`
- `version`
- `renderRequest`
- full `document`

Responsibilities:

- Read `layers` in z-order
- Resolve image layer sources
- Prefer original asset lookup from `assetRegistry` when `assetId` exists
- Fall back to `sourceUrl`
- Tolerate `sourceDataUrl` in phase 2

Acceptance:

- Render service can resolve every layer into a render instruction

### C2. Implement image layer rendering

Must support:

- Source resolution by `assetId` or `sourceUrl`
- Crop rectangle
- Scale
- Rotation
- Flip
- Opacity
- Layer ordering

Phase-2 recommendation:

- Filters may initially be minimal or approximate if exact parity is expensive
- The preview should prioritize correct layout and crop over perfect visual parity

Acceptance:

- Preview output preserves crop region, layout position, and layer stacking

### C3. Implement text layer rendering

Must support:

- Content
- Font size
- Font weight
- Fill
- Stroke
- Shadow
- Background color
- Basic gradient support when present

Notes:

- If exact font availability differs from frontend, document the fallback
- Keep line layout stable enough for preview consistency

Acceptance:

- Text layers appear in correct position and approximate style

### C4. Implement decoration and doodle rendering

Decoration layer:

- shape or sticker selection
- width and height
- fill color
- transform

Doodle layer:

- point path
- stroke
- stroke width
- transform

Acceptance:

- Non-image layers are included in final preview

### C5. Implement `/renders/preview`

Flow:

1. Validate request body
2. Resolve all assets
3. Render image to requested `width/height/format`
4. Write preview image to storage
5. Optionally write separate download artifact
6. Return `RenderResult`

Response shape:

```json
{
  "documentId": "doc_srv_xxx",
  "version": 12,
  "format": "png",
  "width": 1080,
  "height": 1350,
  "previewUrl": "https://cdn.example.com/editor-renders/doc_srv_xxx/v12-preview.png",
  "downloadUrl": "https://cdn.example.com/editor-renders/doc_srv_xxx/v12-download.png"
}
```

Acceptance:

- Request returns a valid preview URL
- Frontend can use that URL in workflow apply fallback path

### C6. Add render error handling

Recommended statuses:

- `400` for invalid payload
- `404` for missing asset
- `422` for renderable-but-invalid document shape
- `500` for unexpected internal failure

Recommended error payload:

```json
{
  "error": {
    "code": "RENDER_FAILED",
    "message": "Unable to render preview."
  }
}
```

Acceptance:

- Failures are diagnosable from logs and API response
- Frontend can safely fall back to client preview path

## Per-Endpoint Mapping

### `POST /assets/images`

Needs:

- Database: `image_assets`
- Object storage: original asset bucket
- Render service: not required

### `GET /documents/:id`

Needs:

- Database: `editor_documents`
- Object storage: not required
- Render service: not required

### `POST /documents`

Needs:

- Database: `editor_documents`
- Object storage: not required
- Render service: not required

### `PUT /documents/:id`

Needs:

- Database: `editor_documents`
- Object storage: not required
- Render service: not required

### `POST /renders/preview`

Needs:

- Database: optional `render_jobs`, required asset/document lookups
- Object storage: render output bucket
- Render service: required

## Suggested Execution Order

### Phase 2A. Persistence Foundation

1. Create `editor_documents`
2. Create `image_assets`
3. Implement `POST /documents`
4. Implement `PUT /documents/:id`
5. Implement `GET /documents/:id`

Acceptance:

- Frontend cloud autosave and restore can run end-to-end without rendering

### Phase 2B. Asset Pipeline

1. Provision original asset storage
2. Implement `POST /assets/images`
3. Persist asset metadata
4. Return stable `sourceUrl`

Acceptance:

- Imported images get `assetId/sourceUrl` and persist across refresh

### Phase 2C. Preview Rendering

1. Provision render output storage
2. Implement scene adapter
3. Implement image/text/decoration/doodle renderers
4. Implement `POST /renders/preview`

Acceptance:

- Frontend workflow apply can use server `previewUrl`

## Acceptance Checklist

### Database

- [ ] `editor_documents` table exists
- [ ] `image_assets` table exists
- [ ] Document create/read/update work with full snapshot payloads
- [ ] Version conflicts return `409` or `412`

### Object Storage

- [ ] Original images are stored durably
- [ ] Returned `sourceUrl` is stable
- [ ] Preview render outputs can be stored and served

### Render Service

- [ ] `/renders/preview` accepts current frontend payload
- [ ] Preview output preserves layer order and crop regions
- [ ] Missing asset and internal render failures return clear errors

### End-to-End

- [ ] Import image -> upload asset -> save document -> reload document works
- [ ] Saved document reopens from cloud with same visible state
- [ ] Workflow preview can use server-side preview URL when backend is configured
