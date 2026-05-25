# Editor Worker Backend

This directory contains the phase-1 backend for the editor MVP using Cloudflare Workers, D1, and R2.

## Included endpoints

- `POST /assets/images`
- `GET /documents/:id`
- `POST /documents`
- `PUT /documents/:id`
- `POST /renders/preview` returns `501` for now so frontend fallback can remain active

## Architecture

- Worker handles API routing, validation, CORS, and stable asset URLs
- D1 stores document snapshots and image metadata
- R2 stores original image binaries
- Asset URLs can work without a public R2 domain by using the Worker reverse-proxy route:
  - `/objects/editor-assets/<assetId>/original.<ext>`

## Files

- `src/index.js`: Worker routes and handlers
- `src/document.js`: document validation and normalization
- `src/image-metadata.js`: lightweight PNG/JPEG/GIF/WebP dimension parsing
- `migrations/0001_init.sql`: D1 schema bootstrap
- `wrangler.toml`: Worker config template

## Setup

1. Create a D1 database and R2 bucket.
2. Replace the placeholder `database_id` in [`wrangler.toml`](/E:/new-study/web-ps/backend/worker/wrangler.toml).
3. Ensure the bucket name matches your R2 bucket.
4. Optionally set:
   - `CORS_ORIGIN` to your frontend origin
   - `PUBLIC_ASSET_BASE_URL` to a CDN/custom domain if you do not want Worker-proxied asset URLs

## Local development

```bash
cd backend/worker
npm install
wrangler d1 execute web-ps-editor --local --file=./migrations/0001_init.sql
npm run dev
```

The frontend should point `VITE_EDITOR_API_BASE_URL` to the Worker dev URL once it is running.

## Deploy

```bash
cd backend/worker
npm install
npm run deploy
```

## API notes

- Request and response JSON use `camelCase`
- Documents are stored as full snapshots
- `sourceDataUrl` is tolerated and stored unchanged inside document JSON
- Optimistic concurrency is enforced with `version`
- Missing documents return `404`
- Version conflicts return `409`
- Unsupported image types return `415`
- Unreadable images return `422`
