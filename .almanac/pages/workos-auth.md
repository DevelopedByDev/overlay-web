---
title: WorkOS Auth
topics: [stack, systems, auth, backend, clients]
files:
  - src/lib/workos-auth.ts
  - src/lib/app-api-auth.ts
  - src/contexts/AuthContext.tsx
  - src/app/auth/sign-in/page.tsx
  - src/app/api/auth/session/route.ts
  - src/app/api/auth/native/refresh/route.ts
  - src/app/api/auth/desktop-link/route.ts
  - src/components/app/GuestGateProvider.tsx
  - convex/lib/auth.ts
  - docs/backend-overview.md
---

# WorkOS Auth

Overlay uses WorkOS for user authentication. Browser sessions are stored in a signed and encrypted `overlay_session` cookie, while native and extension clients use bearer WorkOS access tokens against the same [[canonical-app-api]] routes. `resolveAuthenticatedAppUser()` is the shared resolver for cookie auth, bearer auth, and internal service auth.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `src/lib/workos-auth.ts` - creates WorkOS clients, signs cookies, encrypts session payloads, handles redirects, and normalizes desktop/mobile redirect behavior.
- `src/lib/app-api-auth.ts` - resolves app users across browser, bearer-token, and internal service authentication.
- `src/contexts/AuthContext.tsx` - checks `/api/auth/session` with same-origin credentials and `no-store` so browser auth state follows the current `overlay_session` cookie.
- `src/app/auth/sign-in/page.tsx` - refreshes the client auth context and the server route tree after email/password sign-in before navigating to the redirect target.
- `src/components/app/GuestGateProvider.tsx` - renders guest sign-in prompts only while the auth context is unauthenticated.
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

After email/password sign-in, a successful API response is not enough to hide web guest prompts. The sign-in page must call `refreshSession()` and `router.refresh()` before `router.replace(redirectUrl)` so the client `AuthProvider`, the guest gate, and the server app layout all observe the new `overlay_session` cookie.

<!-- stub: capture WorkOS callback, JWT issuer/audience, and session-transfer failures. -->
