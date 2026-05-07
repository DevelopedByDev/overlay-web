---
title: R2 File Storage
topics: [stack, storage, backend, operations]
files:
  - src/lib/r2.ts
  - src/lib/r2-budget.ts
  - src/lib/storage-keys.ts
  - src/app/api/app/files/presign/route.ts
  - src/app/api/app/files/upload-url/route.ts
  - scripts/smoke-r2-connectivity.ts
  - docs/cloudflare-docs/r2-ref.md
---

# R2 File Storage

Overlay uses Cloudflare R2 as durable object storage for uploaded files and generated outputs. `src/lib/r2.ts` wraps the S3-compatible client, presigned upload/download URLs, object deletion, and object metadata checks, while Convex stores the logical metadata for files and outputs.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `src/lib/r2.ts` - creates the R2 S3 client and enforces the presign TTL cap.
- `src/lib/r2-budget.ts` - handles storage budget behavior.
- `src/lib/storage-keys.ts` - builds object keys for files and outputs.
- `src/app/api/app/files/presign/route.ts` and `src/app/api/app/files/upload-url/route.ts` - expose upload URL helpers through the app API.
- `scripts/smoke-r2-connectivity.ts` - checks R2 connectivity.
- `docs/cloudflare-docs/r2-ref.md` - local reference material for R2.

## Configuration

Environment variables visible in `.env.example`: `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_GLOBAL_BUDGET_BYTES`, `R2_PRESIGN_TTL_SECONDS`, and `S3_API`.

## Future Capture

### Operational constraints

<!-- stub: capture bucket setup, TTL choices, quota behavior, and presign failures. -->
