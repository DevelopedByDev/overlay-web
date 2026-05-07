---
title: WorkOS Auth
topics: [stack, systems, auth, backend, clients]
files:
  - src/lib/workos-auth.ts
  - src/lib/app-api-auth.ts
  - src/app/api/auth/native/refresh/route.ts
  - src/app/api/auth/desktop-link/route.ts
  - convex/lib/auth.ts
  - docs/backend-overview.md
---

# WorkOS Auth

Overlay uses WorkOS for user authentication. Browser sessions are stored in a signed and encrypted `overlay_session` cookie, while native and extension clients use bearer WorkOS access tokens against the same app API routes. `resolveAuthenticatedAppUser()` is the shared resolver for cookie auth, bearer auth, and internal service auth.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `src/lib/workos-auth.ts` - creates WorkOS clients, signs cookies, encrypts session payloads, handles redirects, and normalizes desktop/mobile redirect behavior.
- `src/lib/app-api-auth.ts` - resolves app users across browser, bearer-token, and internal service authentication.
- `src/app/api/auth/native/refresh/route.ts` - refreshes native client sessions.
- `src/app/api/auth/desktop-link/route.ts` - supports desktop linking flows.
- `convex/lib/auth.ts` - verifies WorkOS JWT claims for Convex-facing auth checks.
- `docs/backend-overview.md` - documents browser, native, and service auth models.

## Configuration

Environment variables visible in `.env.example`: `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `DEV_WORKOS_CLIENT_ID`, `DEV_WORKOS_API_KEY`, `SESSION_SECRET`, `SESSION_TRANSFER_KEY`, `SESSION_COOKIE_ENCRYPTION_KEY`, `INTERNAL_API_SECRET`, and `INTERNAL_SERVICE_AUTH_SECRET`.

## Future Capture

### Security invariants

<!-- stub: capture token lifetime, cookie handling, and native refresh constraints. -->

### Known gotchas

<!-- stub: capture WorkOS callback, JWT issuer/audience, and session-transfer failures. -->
