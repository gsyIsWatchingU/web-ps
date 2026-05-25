# Editor Backend API Contract

## Summary

This document defines the minimum backend API contract required by the current editor frontend.

The current frontend behavior is:

- Local draft remains the fallback
- Cloud mode is enabled when `VITE_EDITOR_API_BASE_URL` is configured
- The frontend uploads original images, saves full `EditorDocument` snapshots, reads documents back by `id`, and optionally requests server-side preview renders

This contract is intentionally minimal and optimized for phase-2 integration.

## Conventions

- Base URL comes from `VITE_EDITOR_API_BASE_URL`
- All request bodies sent by the frontend use `camelCase`
- JSON responses should preferably use `camelCase`
- For compatibility, the frontend currently also accepts these response aliases:
  - `asset_id` in addition to `assetId`
  - `source_url` in addition to `sourceUrl`
  - `document_id` in addition to `documentId`
  - `preview_url` in addition to `previewUrl`
  - `download_url` in addition to `downloadUrl`
  - `mime_type` in addition to `mimeType`
  - `size_bytes` in addition to `sizeBytes`
  - `created_at` in addition to `createdAt`
- Timestamps should be ISO 8601 strings
- Unless otherwise stated, `Content-Type` is `application/json`

## Endpoint List

- `POST /assets/images`
- `GET /documents/:id`
- `POST /documents`
- `PUT /documents/:id`
- `POST /renders/preview`

## 1. Upload Source Image

### `POST /assets/images`

Uploads the original user-selected image file.

### Request

- Content type: `multipart/form-data`
- Form field:
  - `file`: binary image file

Example request:

```http
POST /assets/images
Content-Type: multipart/form-data
```

### Success Response

- Status: `200 OK` or `201 Created`

```json
{
  "assetId": "img_01jv4f0zkg9v7j1m6k9x1a2b3c",
  "sourceUrl": "https://cdn.example.com/editor-assets/img_01jv4f0zkg9v7j1m6k9x1a2b3c/original.jpg",
  "width": 3024,
  "height": 4032,
  "mimeType": "image/jpeg",
  "sizeBytes": 2481937,
  "hash": "sha256:5fd1d8c4d5c2d5b2b0d7d8e8f4a3c2b1d9e7f6a5c4b3a2d1e0f9c8b7a6d5e4f",
  "createdAt": "2026-05-25T10:30:45.000Z"
}
```

### Required Response Fields

- `assetId: string`
- `sourceUrl: string`

### Optional Response Fields

- `width: number`
- `height: number`
- `mimeType: string | null`
- `sizeBytes: number | null`
- `hash: string | null`
- `createdAt: string`

## 2. Load Document

### `GET /documents/:id`

Loads a previously saved editor document.

### Request

Example:

```http
GET /documents/doc_srv_01jv4f5df0w9s6m0g7q1k9n8p4
Accept: application/json
```

### Success Response

- Status: `200 OK`
- Response body: full `EditorDocument`

Example:

```json
{
  "id": "doc_srv_01jv4f5df0w9s6m0g7q1k9n8p4",
  "version": 12,
  "name": "Summer Poster",
  "canvas": {
    "presetId": "4:5",
    "width": 1080,
    "height": 1350,
    "backgroundColor": "#fbf6ef",
    "displayBackground": {
      "mode": "grid",
      "color": "#fbf6ef"
    },
    "safeAreaInset": 49,
    "viewport": {
      "zoom": 1,
      "panX": 0,
      "panY": 0
    }
  },
  "layers": [
    {
      "id": "image-layer-1",
      "type": "image",
      "name": "hero-image",
      "visible": true,
      "locked": false,
      "opacity": 1,
      "zIndex": 0,
      "transform": {
        "x": 120,
        "y": 180,
        "scaleX": 0.72,
        "scaleY": 0.72,
        "rotation": 0,
        "flipX": false,
        "flipY": false
      },
      "source": "pending-upload",
      "assetId": "img_01jv4f0zkg9v7j1m6k9x1a2b3c",
      "sourceUrl": "https://cdn.example.com/editor-assets/img_01jv4f0zkg9v7j1m6k9x1a2b3c/original.jpg",
      "sourceDataUrl": null,
      "sourceOrigin": "remote",
      "originalWidth": 3024,
      "originalHeight": 4032,
      "crop": {
        "x": 0,
        "y": 120,
        "width": 3024,
        "height": 3780
      },
      "presetFilterId": null,
      "enhanceProfileId": null,
      "filters": {
        "intensity": 100,
        "brightness": 0,
        "contrast": 0,
        "saturation": 0,
        "vibrance": 0,
        "blur": 0,
        "sharpen": 0,
        "temperature": 0,
        "hue": 0
      },
      "aiMeta": {
        "prompt": "",
        "expandPrompt": "",
        "repairPrompt": "",
        "lastAiAction": null,
        "lastAiRequestedAt": null,
        "lastAiSucceededAt": null,
        "lastAiError": null,
        "model3dTask": {
          "taskId": null,
          "status": "idle",
          "downloadUrl": null,
          "fileName": null,
          "providerModel": null
        },
        "repairTask": {
          "taskId": null,
          "status": "idle",
          "resultUrl": null,
          "downloadUrl": null,
          "fileName": null,
          "providerModel": null,
          "errorMessage": null
        }
      }
    },
    {
      "id": "text-layer-1",
      "type": "text",
      "name": "headline",
      "visible": true,
      "locked": false,
      "opacity": 1,
      "zIndex": 1,
      "transform": {
        "x": 100,
        "y": 140,
        "scaleX": 1,
        "scaleY": 1,
        "rotation": 0,
        "flipX": false,
        "flipY": false
      },
      "content": "Fresh Summer Sale",
      "textTemplateId": "title",
      "businessComponentId": "headline",
      "businessComponentLabel": "Headline",
      "style": {
        "fontFamily": "Arial",
        "fontSize": 88,
        "fontWeight": 800,
        "fill": "#fff5ec",
        "stroke": "#4a2012",
        "strokeWidth": 8,
        "shadow": "0 20px 36px rgba(74, 32, 18, 0.18)",
        "backgroundColor": "#ff9d4d",
        "gradient": ["#ffd36f", "#ff7e45"]
      }
    }
  ],
  "exportConfig": {
    "format": "png",
    "quality": 0.92,
    "scale": 1,
    "qualityPreset": "high",
    "resizeMode": "fixed",
    "sizePreset": "group",
    "width": 1080,
    "height": 1350,
    "scalePercent": 100
  },
  "renderRequest": {
    "format": "png",
    "quality": 0.92,
    "qualityPreset": "high",
    "resizeMode": "fixed",
    "sizePreset": "group",
    "width": 1080,
    "height": 1350,
    "scalePercent": 100,
    "background": {
      "color": "#fbf6ef",
      "transparent": false
    }
  },
  "assetRegistry": {
    "img_01jv4f0zkg9v7j1m6k9x1a2b3c": {
      "assetId": "img_01jv4f0zkg9v7j1m6k9x1a2b3c",
      "sourceUrl": "https://cdn.example.com/editor-assets/img_01jv4f0zkg9v7j1m6k9x1a2b3c/original.jpg",
      "originalWidth": 3024,
      "originalHeight": 4032,
      "mimeType": "image/jpeg",
      "sizeBytes": 2481937,
      "hash": "sha256:5fd1d8c4d5c2d5b2b0d7d8e8f4a3c2b1d9e7f6a5c4b3a2d1e0f9c8b7a6d5e4f",
      "createdAt": "2026-05-25T10:30:45.000Z"
    }
  },
  "draftMeta": {
    "enabled": true,
    "storageKey": "web-ps/editor-draft",
    "lastSavedAt": "2026-05-25T10:31:12.000Z"
  },
  "workflowMeta": {
    "sceneTag": "poster",
    "version": 3,
    "lastExportedAt": null,
    "lastAppliedAt": null,
    "returnMode": "postmessage",
    "targetOrigin": "*",
    "sessionId": null
  },
  "templateMeta": {
    "templateId": null,
    "templateName": null,
    "templateVersion": 1,
    "sceneType": null,
    "platformPresetId": null,
    "platformName": null,
    "usageTip": null,
    "aiSlots": []
  },
  "validation": {
    "status": "idle",
    "summary": "Validation not run yet.",
    "issues": [],
    "checkedAt": null
  },
  "updatedAt": "2026-05-25T10:31:15.000Z"
}
```

### Not Found Response

- Status: `404 Not Found`
- The frontend treats this as "no remote document available" and falls back to the local draft

Example:

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Document not found."
  }
}
```

## 3. Create Document

### `POST /documents`

Creates a new cloud document from the full editor snapshot.

### Request

- Content type: `application/json`
- Request body: full `EditorDocument`

Example:

```json
{
  "id": "doc-editor-mvp",
  "version": 4,
  "name": "Summer Poster",
  "canvas": {
    "presetId": "4:5",
    "width": 1080,
    "height": 1350,
    "backgroundColor": "#fbf6ef",
    "displayBackground": {
      "mode": "grid",
      "color": "#fbf6ef"
    },
    "safeAreaInset": 49,
    "viewport": {
      "zoom": 1,
      "panX": 0,
      "panY": 0
    }
  },
  "layers": [],
  "exportConfig": {
    "format": "png",
    "quality": 0.92,
    "scale": 1,
    "qualityPreset": "high",
    "resizeMode": "fixed",
    "sizePreset": "group",
    "width": 1080,
    "height": 1350,
    "scalePercent": 100
  },
  "renderRequest": {
    "format": "png",
    "quality": 0.92,
    "qualityPreset": "high",
    "resizeMode": "fixed",
    "sizePreset": "group",
    "width": 1080,
    "height": 1350,
    "scalePercent": 100,
    "background": {
      "color": "#fbf6ef",
      "transparent": false
    }
  },
  "assetRegistry": {},
  "draftMeta": {
    "enabled": true,
    "storageKey": "web-ps/editor-draft",
    "lastSavedAt": "2026-05-25T10:31:12.000Z"
  },
  "workflowMeta": {
    "sceneTag": "poster",
    "version": 1,
    "lastExportedAt": null,
    "lastAppliedAt": null,
    "returnMode": "postmessage",
    "targetOrigin": "*",
    "sessionId": null
  },
  "templateMeta": {
    "templateId": null,
    "templateName": null,
    "templateVersion": 1,
    "sceneType": null,
    "platformPresetId": null,
    "platformName": null,
    "usageTip": null,
    "aiSlots": []
  },
  "validation": {
    "status": "idle",
    "summary": "Validation not run yet.",
    "issues": [],
    "checkedAt": null
  },
  "updatedAt": "2026-05-25T10:31:15.000Z"
}
```

### Success Response

- Status: `200 OK` or `201 Created`

```json
{
  "id": "doc_srv_01jv4f5df0w9s6m0g7q1k9n8p4",
  "version": 1
}
```

### Required Response Fields

- `id: string`
- `version: number`

## 4. Update Document

### `PUT /documents/:id`

Updates an existing cloud document.

### Request

- Content type: `application/json`
- Request body: full `EditorDocument`

Example:

```json
{
  "id": "doc_srv_01jv4f5df0w9s6m0g7q1k9n8p4",
  "version": 11,
  "name": "Summer Poster",
  "canvas": {
    "presetId": "4:5",
    "width": 1080,
    "height": 1350,
    "backgroundColor": "#fbf6ef",
    "displayBackground": {
      "mode": "grid",
      "color": "#fbf6ef"
    },
    "safeAreaInset": 49,
    "viewport": {
      "zoom": 1,
      "panX": 0,
      "panY": 0
    }
  },
  "layers": [],
  "exportConfig": {
    "format": "png",
    "quality": 0.92,
    "scale": 1,
    "qualityPreset": "high",
    "resizeMode": "fixed",
    "sizePreset": "group",
    "width": 1080,
    "height": 1350,
    "scalePercent": 100
  },
  "renderRequest": {
    "format": "png",
    "quality": 0.92,
    "qualityPreset": "high",
    "resizeMode": "fixed",
    "sizePreset": "group",
    "width": 1080,
    "height": 1350,
    "scalePercent": 100,
    "background": {
      "color": "#fbf6ef",
      "transparent": false
    }
  },
  "assetRegistry": {},
  "draftMeta": {
    "enabled": true,
    "storageKey": "web-ps/editor-draft",
    "lastSavedAt": "2026-05-25T10:31:12.000Z"
  },
  "workflowMeta": {
    "sceneTag": "poster",
    "version": 3,
    "lastExportedAt": null,
    "lastAppliedAt": null,
    "returnMode": "postmessage",
    "targetOrigin": "*",
    "sessionId": null
  },
  "templateMeta": {
    "templateId": null,
    "templateName": null,
    "templateVersion": 1,
    "sceneType": null,
    "platformPresetId": null,
    "platformName": null,
    "usageTip": null,
    "aiSlots": []
  },
  "validation": {
    "status": "idle",
    "summary": "Validation not run yet.",
    "issues": [],
    "checkedAt": null
  },
  "updatedAt": "2026-05-25T10:31:15.000Z"
}
```

### Success Response

- Status: `200 OK`

```json
{
  "id": "doc_srv_01jv4f5df0w9s6m0g7q1k9n8p4",
  "version": 12
}
```

### Version Conflict Response

- Status: `409 Conflict` or `412 Precondition Failed`
- The frontend treats either status as a conflict and stops silent cloud overwrite

Example:

```json
{
  "error": {
    "code": "DOCUMENT_VERSION_CONFLICT",
    "message": "Document version is stale.",
    "currentVersion": 12
  }
}
```

## 5. Request Render Preview

### `POST /renders/preview`

Requests a server-side preview render using the current document snapshot and render settings.

### Request

```json
{
  "documentId": "doc_srv_01jv4f5df0w9s6m0g7q1k9n8p4",
  "version": 12,
  "renderRequest": {
    "format": "png",
    "quality": 0.92,
    "qualityPreset": "high",
    "resizeMode": "fixed",
    "sizePreset": "group",
    "width": 1080,
    "height": 1350,
    "scalePercent": 100,
    "background": {
      "color": "#fbf6ef",
      "transparent": false
    }
  },
  "document": {
    "id": "doc_srv_01jv4f5df0w9s6m0g7q1k9n8p4",
    "version": 12,
    "name": "Summer Poster",
    "canvas": {
      "presetId": "4:5",
      "width": 1080,
      "height": 1350,
      "backgroundColor": "#fbf6ef",
      "displayBackground": {
        "mode": "grid",
        "color": "#fbf6ef"
      },
      "safeAreaInset": 49,
      "viewport": {
        "zoom": 1,
        "panX": 0,
        "panY": 0
      }
    },
    "layers": [],
    "exportConfig": {
      "format": "png",
      "quality": 0.92,
      "scale": 1,
      "qualityPreset": "high",
      "resizeMode": "fixed",
      "sizePreset": "group",
      "width": 1080,
      "height": 1350,
      "scalePercent": 100
    },
    "renderRequest": {
      "format": "png",
      "quality": 0.92,
      "qualityPreset": "high",
      "resizeMode": "fixed",
      "sizePreset": "group",
      "width": 1080,
      "height": 1350,
      "scalePercent": 100,
      "background": {
        "color": "#fbf6ef",
        "transparent": false
      }
    },
    "assetRegistry": {},
    "draftMeta": {
      "enabled": true,
      "storageKey": "web-ps/editor-draft",
      "lastSavedAt": "2026-05-25T10:31:12.000Z"
    },
    "workflowMeta": {
      "sceneTag": "poster",
      "version": 3,
      "lastExportedAt": null,
      "lastAppliedAt": null,
      "returnMode": "postmessage",
      "targetOrigin": "*",
      "sessionId": null
    },
    "templateMeta": {
      "templateId": null,
      "templateName": null,
      "templateVersion": 1,
      "sceneType": null,
      "platformPresetId": null,
      "platformName": null,
      "usageTip": null,
      "aiSlots": []
    },
    "validation": {
      "status": "idle",
      "summary": "Validation not run yet.",
      "issues": [],
      "checkedAt": null
    },
    "updatedAt": "2026-05-25T10:31:15.000Z"
  }
}
```

### Success Response

- Status: `200 OK`

```json
{
  "documentId": "doc_srv_01jv4f5df0w9s6m0g7q1k9n8p4",
  "version": 12,
  "format": "png",
  "width": 1080,
  "height": 1350,
  "previewUrl": "https://cdn.example.com/editor-renders/doc_srv_01jv4f5df0w9s6m0g7q1k9n8p4/v12-preview.png",
  "downloadUrl": "https://cdn.example.com/editor-renders/doc_srv_01jv4f5df0w9s6m0g7q1k9n8p4/v12-download.png"
}
```

### Required Response Fields

- `documentId: string`
- `version: number`
- `format: "png" | "jpeg"`
- `width: number`
- `height: number`
- `previewUrl: string | null`

### Optional Response Fields

- `downloadUrl: string | null`

## EditorDocument Notes

The frontend currently persists the full `EditorDocument` snapshot as-is. Backend implementation should follow these rules:

- Store and return all top-level fields
- Store and return all `layers` entries without dropping unknown fields
- `layers` is a discriminated union keyed by `type`
- `assetRegistry` is the authoritative registry of uploaded original images
- `sourceDataUrl` may still appear during phase 2 and must be tolerated
- `draftMeta`, `workflowMeta`, `templateMeta`, and `validation` are included in the payload and should round-trip unchanged unless the backend has a strong reason to normalize them

## Layer Shapes

### Image Layer

```json
{
  "id": "image-layer-1",
  "type": "image",
  "name": "hero-image",
  "visible": true,
  "locked": false,
  "opacity": 1,
  "zIndex": 0,
  "transform": {
    "x": 120,
    "y": 180,
    "scaleX": 0.72,
    "scaleY": 0.72,
    "rotation": 0,
    "flipX": false,
    "flipY": false
  },
  "source": "pending-upload",
  "assetId": "img_01jv4f0zkg9v7j1m6k9x1a2b3c",
  "sourceUrl": "https://cdn.example.com/editor-assets/img_01jv4f0zkg9v7j1m6k9x1a2b3c/original.jpg",
  "sourceDataUrl": null,
  "sourceOrigin": "remote",
  "originalWidth": 3024,
  "originalHeight": 4032,
  "crop": {
    "x": 0,
    "y": 120,
    "width": 3024,
    "height": 3780
  },
  "presetFilterId": null,
  "enhanceProfileId": null,
  "filters": {
    "intensity": 100,
    "brightness": 0,
    "contrast": 0,
    "saturation": 0,
    "vibrance": 0,
    "blur": 0,
    "sharpen": 0,
    "temperature": 0,
    "hue": 0
  },
  "aiMeta": {
    "prompt": "",
    "expandPrompt": "",
    "repairPrompt": "",
    "lastAiAction": null,
    "lastAiRequestedAt": null,
    "lastAiSucceededAt": null,
    "lastAiError": null,
    "model3dTask": {
      "taskId": null,
      "status": "idle",
      "downloadUrl": null,
      "fileName": null,
      "providerModel": null
    },
    "repairTask": {
      "taskId": null,
      "status": "idle",
      "resultUrl": null,
      "downloadUrl": null,
      "fileName": null,
      "providerModel": null,
      "errorMessage": null
    }
  }
}
```

### Text Layer

```json
{
  "id": "text-layer-1",
  "type": "text",
  "name": "headline",
  "visible": true,
  "locked": false,
  "opacity": 1,
  "zIndex": 1,
  "transform": {
    "x": 100,
    "y": 140,
    "scaleX": 1,
    "scaleY": 1,
    "rotation": 0,
    "flipX": false,
    "flipY": false
  },
  "content": "Fresh Summer Sale",
  "textTemplateId": "title",
  "businessComponentId": "headline",
  "businessComponentLabel": "Headline",
  "style": {
    "fontFamily": "Arial",
    "fontSize": 88,
    "fontWeight": 800,
    "fill": "#fff5ec",
    "stroke": "#4a2012",
    "strokeWidth": 8,
    "shadow": "0 20px 36px rgba(74, 32, 18, 0.18)",
    "backgroundColor": "#ff9d4d",
    "gradient": ["#ffd36f", "#ff7e45"]
  }
}
```

### Decoration Layer

```json
{
  "id": "decoration-layer-1",
  "type": "decoration",
  "name": "price-tag",
  "visible": true,
  "locked": false,
  "opacity": 1,
  "zIndex": 2,
  "transform": {
    "x": 820,
    "y": 120,
    "scaleX": 1,
    "scaleY": 1,
    "rotation": -8,
    "flipX": false,
    "flipY": false
  },
  "businessComponentId": "price-tag",
  "businessComponentLabel": "Price Tag",
  "decorationKind": "shape",
  "shape": "heart",
  "sticker": "sparkle",
  "width": 180,
  "height": 160,
  "fill": "#cf5b2d"
}
```

### Doodle Layer

```json
{
  "id": "doodle-layer-1",
  "type": "doodle",
  "name": "doodle",
  "visible": true,
  "locked": false,
  "opacity": 1,
  "zIndex": 3,
  "transform": {
    "x": 200,
    "y": 300,
    "scaleX": 1,
    "scaleY": 1,
    "rotation": 0,
    "flipX": false,
    "flipY": false
  },
  "points": [
    { "x": 0, "y": 0 },
    { "x": 10, "y": 8 },
    { "x": 26, "y": 20 }
  ],
  "stroke": "#cf5b2d",
  "strokeWidth": 8
}
```

## Error Response Recommendation

The frontend only requires HTTP status codes to behave correctly, but the backend should return a stable JSON error shape:

```json
{
  "error": {
    "code": "SOME_MACHINE_CODE",
    "message": "Human readable message."
  }
}
```

Recommended codes:

- `DOCUMENT_NOT_FOUND`
- `DOCUMENT_VERSION_CONFLICT`
- `ASSET_UPLOAD_FAILED`
- `RENDER_FAILED`
- `VALIDATION_ERROR`

## Backend Implementation Notes

- Treat the document payload as a full snapshot update, not a patch
- The frontend may send `sourceDataUrl` in phase 2; do not reject it
- For `PUT /documents/:id`, prefer optimistic concurrency based on `version`
- On successful save, always return the canonical server `id` and latest `version`
- On preview render, prefer using original uploaded assets from `assetRegistry` when `assetId` is present
