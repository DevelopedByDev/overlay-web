---
title: "API Reference"
description: "Overlay REST API reference. Auto-generated in Phase 7."
---

# API Reference

The Overlay REST API is the canonical contract for all clients.

> **Status**: OpenAPI spec generation is planned for Phase 7. This page will be auto-generated from route-level Zod schemas.

## Base URL

```text
https://overlay.yourcompany.com/api
```

## Authentication

- **Browser**: Session cookie (`overlay_session`)
- **Native/Desktop**: `Authorization: Bearer <workos-access-token>`
- **Service-to-service**: `x-overlay-service-auth: <internal-secret>`

## Key Endpoints

### App Bootstrap

```text
GET /api/app/bootstrap
```

Returns: user, entitlements, model catalog, feature flags.

### Conversations

```text
GET    /api/app/conversations
POST   /api/app/conversations
PATCH  /api/app/conversations
DELETE /api/app/conversations/:id
POST   /api/app/conversations/message
POST   /api/app/conversations/ask
POST   /api/app/conversations/act
```

### Files

```text
GET /api/app/files
GET /api/app/files/presign
POST /api/app/files/ingest-document
```

### Billing

```text
GET  /api/entitlements
GET  /api/subscription
POST /api/checkout
POST /api/portal
POST /api/topups/checkout
```

## Rate Limits

| Route | Window | Max Requests |
|-------|--------|--------------|
| `/api/auth/*` | 1 min | 10 |
| `/api/app/conversations/ask` | 1 min | 30 |
| `/api/app/files/presign` | 1 min | 60 |

## Phase 7: Auto-Generated OpenAPI

In Phase 7, we will:

1. Add Zod schemas to every API route
2. Generate `openapi.json` via `zod-to-openapi`
3. Publish to `/docs/api/openapi.json`
4. Render interactive docs with Swagger UI
