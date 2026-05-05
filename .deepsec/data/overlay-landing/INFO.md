# overlay-landing

## What this codebase does

Overlay is a Next.js 15 AI workspace backed by Convex and WorkOS. Users chat with multiple AI models, store memories/files/notes/projects, generate images/videos, run Browser Use and Daytona execution tasks, schedule automations, and connect external apps through Composio. Sensitive state spans WorkOS sessions/JWTs, Convex user data, Stripe usage/billing, R2 object keys and presigned URLs, provider API keys, and tool-execution budgets.

## Auth shape

- Browser auth is `getSession()` from `src/lib/workos-auth.ts`; it verifies the signed/encrypted `overlay_session` cookie, validates/refreshes the WorkOS access token, and returns `session.user.id`.
- App API routes under `/api/app/*` usually call `resolveAuthenticatedAppUser()`, which accepts either browser session, short-lived `x-overlay-service-auth`, or a WorkOS bearer token whose `sub` must match `userId`.
- Middleware protects `/account`, `/api/entitlements`, `/api/portal`, and `/api/convex` using `hasValidSessionCookieSignature()`; `/app` is intentionally public shell and `/api/app/*` does route-level auth for native/server clients.
- Convex functions that accept `userId` should gate with `requireAccessToken(accessToken, userId)`, `validateServerSecret()`, or `requireServerSecret()` from `convex/lib/auth.ts`.
- Internal Next-to-Convex calls use `getInternalApiSecret()` / `INTERNAL_API_SECRET`; internal Next API calls use `buildServiceAuthToken()` / `verifyServiceAuthToken()` with method/path/user binding and replay limits.

## Threat model

Highest impact is cross-user access to Convex records, R2 objects, memories, files, notes, projects, conversations, outputs, or billing entitlements by supplying another `userId`, `fileId`, `outputId`, `projectId`, or storage key. Next is abuse of paid/external execution paths: model generation, Browser Use, Daytona, Composio/MCP/integration actions, automations, and provider keys without entitlement, budget, user, or rate-limit checks. Also watch auth/session flows where redirect state, native PKCE/session transfer, refresh tokens, service auth, or WorkOS JWT verification could be bypassed or logged unsafely.

## Project-specific patterns to flag

- Any `/api/app/*` route using body/query `userId`, `accessToken`, object IDs, or external execution without `resolveAuthenticatedAppUser()` or an equivalent `getSession()` + verified subject check.
- Any Convex query/mutation trusting a caller-supplied `userId` without `requireAccessToken()`, `validateServerSecret()`, or `requireServerSecret()`, especially for files, conversations, memories, projects, outputs, usage, provider keys, automations, and integrations.
- Any R2 operation or presigned URL path not using `keyForFile()`, `keyForOutput()`, `isOwnedFileR2Key()`, `isOwnedOutputR2Key()`, or their assert variants to bind keys under `users/{userId}/...`.
- Any billing/usage-gated action that calls providers before `usage:getEntitlementsByServer`, `ensureBudgetAvailable()`, `isPaidPlan()`, `recordBatch`, and route/user rate limits where applicable.
- Any internal secret or service-auth path that compares raw strings, omits method/path/user binding, accepts `INTERNAL_API_SECRET` from clients, or exposes debug auth helpers in production.

## Known false-positives

- `/app` is intentionally public; it is a guest-visible shell, while `/api/app/*` endpoints perform route-level auth for browser, native, and server tool callers.
- `/api/auth/*`, `/auth/*`, `/api/security/*`, `/api/checkout/verify`, and `/api/webhooks/*` are listed public in middleware; inspect each handler's own validation rather than assuming middleware auth.
- `src/app/api/webhooks/stripe/route.ts` is a removed/deprecated Next webhook returning `410`; real Stripe processing lives in `convex/http.ts`.
- `authDebug` helpers and scripts are diagnostic; Convex `authDebug.inspectAccessToken` is disabled in production and still requires `requireServerSecret()`.
- Logging helpers such as `summarizeJwtForLog`, `summarizeOpaqueTokenForLog`, and `summarizeSessionForLog` are intended redaction paths; flag raw token/session logging instead.
