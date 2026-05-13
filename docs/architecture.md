# Architecture

Overlay is a Next.js app backed by Convex, WorkOS, Stripe, R2, and server-mediated AI/tool providers.

## Source Of Truth

- `src/app/api/**` is the public backend surface for web, mobile, desktop, and extension clients.
- `src/lib/**` holds shared server helpers, auth, billing, model, storage, and tool logic.
- `src/lib/app-contracts.ts` is the shared DTO/type contract for app bootstrap and product data.
- `convex/**` owns durable app state, domain mutations, scheduled work, and Stripe webhook handling.
- `packages/overlay-app-core/**` holds shared cross-surface contracts and UI settings types.

Clients should not call model providers, Stripe, WorkOS admin APIs, R2, or Convex directly unless a route explicitly exists for that surface.

## Auth

- Browser auth uses the signed httpOnly `overlay_session` cookie.
- Native/mobile/desktop auth uses WorkOS bearer access tokens against the same `/api/app/*` backend.
- Internal server-to-server calls use short-lived service auth from `src/lib/service-auth.ts`.
- Shared route authentication flows through `resolveAuthenticatedAppUser()` in `src/lib/app-api-auth.ts`.

Every sensitive `/api/app/*` route should reject requests that lack a valid browser session, mobile bearer token, or service auth token.

## App Bootstrap

`GET /api/app/bootstrap` is the canonical signed-in startup call. It returns user info, entitlements, UI settings, model catalogs, feature flags, navigation destinations, and defaults.

New clients should start from this route and reuse existing API contracts before adding client-specific endpoints.

## Billing

Stripe is used for subscriptions, top-ups, auto top-up preferences, customer portal sessions, and webhook events. Convex is the durable entitlement/usage source of truth after webhook processing.

Important code:

- `src/lib/billing-pricing.ts`
- `src/lib/billing-runtime.ts`
- `src/lib/stripe-billing.ts`
- `convex/subscriptions.ts`
- `convex/usage.ts`
- `convex/stripe.ts`
- `convex/stripeSync.ts`

## Storage

Uploaded files and generated assets are stored through server-mediated flows. R2 object access must remain private and owner-scoped; users should only receive short-lived, validated access.

## Convex

Development commonly uses a separate dev deployment from production. After editing `convex/`, push both deployments:

```bash
npm run convex:push:all
```

Do not pass `.env.local` to production Convex deploy commands; that can point deploys at the dev slug.
