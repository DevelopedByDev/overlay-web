# Security Actions — Overlay

Updated: 2026-04-17

This file is the operator checklist only. It lists the things you still need to do in Vercel, WorkOS, Daytona, Stripe, or your deployment process after the repo-side security fixes.

Code-only fixes that are already implemented are intentionally omitted here.

## Status Key

- `🔲` Required manual action
- `⏳` Strategic follow-up / architectural project
- `✅` Already done in code; no operator action needed

## Immediate Before Production Deploy

### `🔲` Set and rotate the required auth/session secrets in Vercel

Set these in every environment that can run the app:

```bash
SESSION_SECRET=$(openssl rand -hex 32)
SESSION_TRANSFER_KEY=$(openssl rand -hex 32)
SESSION_COOKIE_ENCRYPTION_KEY=$(openssl rand -hex 32)
INTERNAL_API_SECRET=$(openssl rand -hex 32)
INTERNAL_SERVICE_AUTH_SECRET=$(openssl rand -hex 32)
```

Rules:

- Every value must be at least 32 characters after trimming.
- `SESSION_TRANSFER_KEY`, `SESSION_COOKIE_ENCRYPTION_KEY`, `INTERNAL_API_SECRET`, and `INTERNAL_SERVICE_AUTH_SECRET` must all be different.
- `INTERNAL_SERVICE_AUTH_SECRET` must not equal `INTERNAL_API_SECRET`.
- Rotating `SESSION_SECRET` or `SESSION_COOKIE_ENCRYPTION_KEY` will log users out. Plan that intentionally.
- In production, `INTERNAL_SERVICE_AUTH_SECRET` is now required.

Why this matters:

- Session cookies are now verified and fail closed.
- Service-auth signing is now separated from the Convex server-secret trust root.

### `🔲` Remove any production override that leaves CSP in report-only mode

Production now defaults to enforced CSP if `SECURITY_CSP_ENFORCE` is unset.

You should:

- Delete `SECURITY_CSP_ENFORCE=false` from production if it exists.
- Either leave it unset in production or set `SECURITY_CSP_ENFORCE=true`.
- Keep report-only mode only in development or temporary staged rollout environments.

Why this matters:

- Report-only CSP is visibility, not protection.

### `🔲` Deploy the app and push Convex changes to both backends

The medium-severity fix for rate limiting added a new Convex table and mutation. Those changes have to be deployed to both Convex environments.

Run:

```bash
npm run convex:push:all
```

Then deploy the Next.js app with the updated environment variables.

## This Sprint

### `🔲` Enable WorkOS Bot Protection

In the WorkOS dashboard:

1. Go to Authentication.
2. Open Bot Protection.
3. Enable it for your auth flows.

Optional but recommended:

- Add Turnstile or an equivalent challenge on any custom sign-up or reset flows you host yourself.

Why this matters:

- The new durable rate limiter helps, but bot protection is still useful for auth spraying and credential stuffing.

### `🔲` Harden Daytona network egress and runtime limits

In Daytona, configure:

- Egress allowlists for only the external destinations your sandboxes actually need.
- Explicit blocking for:
  - `127.0.0.0/8`
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`
  - `169.254.0.0/16`
  - metadata endpoints and other link-local addresses
- CPU, memory, disk, and wall-clock time limits per sandbox
- Artifact retention and scanning policies, if Daytona exposes them

Minimum validation:

- A sandbox request to `http://169.254.169.254/` must fail.
- A sandbox request to `http://127.0.0.1/` must fail.
- A sandbox request to private RFC1918 addresses must fail.

Why this matters:

- Repo-side tool exposure is now narrower, but Daytona is still a privileged execution surface.

### `🔲` Verify rate-limit behavior in the deployed environment

The code now uses Convex-backed shared rate limiting with in-memory fallback. After deploy, verify:

- Repeated auth attempts hit `429` across multiple app instances, not just one instance.
- Checkout, top-up, browser-task, Daytona, image, and video routes all rate-limit correctly.
- Logs do not show repeated `rate_limit_backend_fallback` events.

Why this matters:

- If Convex is unreachable or secrets are misconfigured, the limiter falls back locally. That is safe as a fallback, but not what you want as the steady state.

### `🔲` Verify session revocation works the way you expect

After deploy:

1. Sign in normally.
2. Revoke the WorkOS session or invalidate the upstream token.
3. Confirm the app forces logout instead of continuing to trust the old cookie.

Why this matters:

- This is the highest-priority auth fix and it should be validated directly.

## Conditional Precautionary Actions

### `🔲` Rotate provider keys if any environment ever exposed the old provider-key path

If any deployed environment previously allowed raw provider-key retrieval or broader-than-intended internal key access, rotate:

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `COMPOSIO_API_KEY`
- `AI_GATEWAY_API_KEY`
- Any other provider key that was reachable through that path

Then update the new values in:

- Vercel environment variables
- Any secret manager or vault you use for provider-key storage

Also delete obsolete secrets if they still exist:

- `PROVIDER_KEYS_SECRET`
- `MINIMAX_API_KEY`
- Any unused Mixpanel-era keys or vault objects that no longer back live code

Why this matters:

- Secret exposure is one of the few classes of issue where rotation is safer than assuming there was no abuse.

## Architectural Follow-Ups

### `⏳` Replace the remaining shared-secret Convex trust root

What remains:

- `INTERNAL_API_SECRET` is still the Convex server-auth trust root.

Recommended direction:

- Move service-to-service trust to short-lived KMS-signed tokens or an equivalent asymmetric signing model.
- Include `jti` replay protection in durable storage.
- Separate production, staging, and preview signing material fully.

Why this matters:

- The current code narrows risk materially, but one long-lived root secret still has too much blast radius.

### `⏳` Add step-up auth for high-risk actions

Recommended scope:

- billing portal access
- payment method changes
- exports
- integrations
- destructive tool actions

Why this matters:

- A valid primary session should not automatically authorize every high-impact action.

### `⏳` Decide whether you want a high-sensitivity encrypted-data tier

Possible feature:

- Optional end-to-end encryption for the most sensitive user content

Tradeoff:

- Better protection against server compromise
- Worse server-side search, retrieval, and agent usability unless the product architecture changes

## Post-Deploy Validation Checklist

- `🔲` `npm audit --omit=dev --audit-level=high` returns clean for production dependencies.
- `🔲` Protected routes reject tampered `overlay_session` cookies at middleware time.
- `🔲` Revoked WorkOS sessions no longer survive on stale local cookies.
- `🔲` Convex-backed rate limiting is active in production and not falling back continuously.
- `🔲` Production CSP is enforced, not report-only.
- `🔲` Daytona cannot reach localhost, metadata services, or private network ranges.
- `🔲` WorkOS Bot Protection is enabled and visible in the dashboard.
