---
title: Canonical App API
topics: [systems, flows, backend, clients]
files:
  - docs/backend-overview.md
  - src/app/api/app/bootstrap/route.ts
  - src/app/api/app/conversations/act/route.ts
  - src/lib/app-api-auth.ts
  - src/lib/app-contracts.ts
---

# Canonical App API

Overlay treats the Next.js routes under `src/app/api/**` as the canonical backend contract for web, desktop, mobile, Chrome extension, and future clients. `docs/backend-overview.md` states that clients should reuse these routes for auth interpretation, model access, billing checks, usage metering, memory and retrieval injection, and tool orchestration instead of implementing client-specific business logic.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `docs/backend-overview.md` - documents the API-first contract and lists the canonical routes for clients.
- `src/app/api/app/bootstrap/route.ts` - returns the signed-in bootstrap payload: user, entitlements, UI settings, model catalogs, feature flags, destinations, and defaults.
- `src/app/api/app/conversations/act/route.ts` - runs agentic turns with auth, model routing, retrieval, tools, budget checks, persistence, and metering.
- `src/lib/app-api-auth.ts` - resolves authenticated app users for browser cookies, bearer tokens, and internal service auth.
- `src/lib/app-contracts.ts` - re-exports shared DTOs from [[shared-app-core]] for API consumers.

## Future Capture

### Invariants

<!-- stub: capture route-level contracts that clients must not bypass. -->

### Known gotchas

<!-- stub: capture mismatches between web behavior and native or extension clients. -->
