# `src/shared/` — isomorphic code

Modules here must be safe to import from **both** client and server bundles.

## Allowed

- Pure functions, types, constants
- `NEXT_PUBLIC_*` env via `@/shared/env/public-env` only
- Browser APIs (`TextEncoder`, `URL`, etc.) and universal libraries

## Not allowed

- `process.env` (except in `env/public-env.ts`)
- Node builtins (`node:crypto`, `node:fs`, `node:dns`, …)
- `server-only`, `@/server/*`, Route Handler types (`NextRequest` from `next/server`)
- Non-isomorphic SDKs (`@sentry/nextjs`, server Stripe, …)
- `'use client'` modules (use `src/components/` or `src/features/`)

## Server-only counterparts

| Was in shared | Now in server |
|---------------|---------------|
| `web/url.ts` (`getBaseUrl`, …) | `@/server/web/app-url` |
| `security/ssrf.ts` | `@/server/security/ssrf` |
| `security/security-events.ts` | `@/server/observability/security-events` |
| `hashTextContent` in `storage/convex-file-content` | `@/server/storage/text-content-hash` |
| Convex React client | `@/components/providers/convex-react-client` |

Run `node scripts/enforce-shared-isomorphic.mjs` in CI or locally after editing this tree.
