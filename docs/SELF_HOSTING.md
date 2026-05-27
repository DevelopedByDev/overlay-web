# Self Hosting

This guide covers the Phase 6 runtime configuration path for running Overlay outside the default Vercel, WorkOS, Stripe, and Cloudflare R2 SaaS setup.

For tenant boundaries and enterprise role modeling, see [Tenancy And Role Model](./TENANCY.md). The short version: self-hosted and managed-cloud enterprise deployments are single-customer deployments; students, teachers, parents, admins, departments, and classes are roles or groups inside that deployment, not tenants.

For licensing and brand constraints, see [Licensing](./LICENSING.md) and [Legal Self-Hosting Notes](./LEGAL_SELF_HOSTING_NOTES.md). The short version: core product code is `AGPL-3.0-or-later`, reusable SDK/contract packages are `Apache-2.0`, and modified distributions need their own branding unless LayerNorm Inc. gives written permission.

The app now loads configuration from three layers, highest precedence first:

1. Environment variables.
2. `OVERLAY_CONFIG_FILE`, normally `overlay.config.json`.
3. The default config in `src/shared/config/defaultOverlayRuntimeConfig.ts`.

Use the examples in [Deployment Profiles](#deployment-profiles) as starting points. They are validated by `npm run docs:check:self-hosting`.

## Required Environment Variables

Minimum app runtime variables:

| Variable | Required when | Notes |
| --- | --- | --- |
| `OVERLAY_CONFIG_FILE` | Using a JSON runtime config | Absolute or repo-relative path, for example `overlay.config.json`. |
| `NEXT_PUBLIC_APP_URL` | Always in deployed environments | Public browser URL for the web app. |
| `NEXT_PUBLIC_CONVEX_URL` | Browser or server talks to Convex | Public Convex deployment URL for the selected environment. Use `DEV_NEXT_PUBLIC_CONVEX_URL` for local dev against a separate dev deployment. |
| `INTERNAL_API_SECRET` | Always | Shared server-to-Convex secret. The same value must be configured in the matching Convex deployment. |
| `INTERNAL_SERVICE_AUTH_SECRET` | App runtime only | Used for internal app service auth. Do not put this in Convex. |
| `SESSION_SECRET` | Cookie sessions | App runtime only. Must be long, random, and environment-specific. |
| `SESSION_TRANSFER_KEY` | Native/session transfer flows | App runtime only. |
| `SESSION_COOKIE_ENCRYPTION_KEY` | Encrypted session cookie payloads | App runtime only. |
| `API_KEY_HASH_SECRET` | `capabilities.apiKeys=true` | App runtime only. HMAC pepper for API key hashes. |

Provider-specific variables:

| Variable | Provider | Notes |
| --- | --- | --- |
| `WORKOS_CLIENT_ID`, `WORKOS_API_KEY` | `auth.provider="workos"` | Use production WorkOS values only with production app and Convex deployments. |
| `DEV_WORKOS_CLIENT_ID`, `DEV_WORKOS_API_KEY` | Local or staging WorkOS fallback | Only use when `auth.allowDevFallbacks=true` in non-production. |
| `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_AUDIENCE` | `auth.provider="oidc"` | The Phase 6.2 OIDC provider is a foundation adapter. Confirm sign-in/callback behavior before production use. |
| `KEYCLOAK_ISSUER_URL`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_REALM` | `auth.provider="keycloak"` | Keycloak uses the OIDC skeleton adapter. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `billing.provider="stripe"` | Required only when billing is enabled. |
| `DEV_STRIPE_SECRET_KEY`, `DEV_STRIPE_WEBHOOK_SECRET` | Staging Stripe | Preferred for non-production. |
| `STRIPE_PAID_UNIT_PRICE_ID`, `STRIPE_TOPUP_UNIT_PRICE_ID`, `STRIPE_PORTAL_CONFIGURATION_ID` | Stripe billing UI | Use matching test or live mode IDs for the selected environment. |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `S3_API` | `storage.provider="r2"` | `S3_API` is the R2 S3-compatible endpoint. |
| `S3_BUCKET_NAME`, `S3_REGION`, `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | `storage.provider="s3"` or `"minio"` | Use `S3_FORCE_PATH_STYLE=true` for MinIO. |
| `OPENROUTER_API_KEY` | `llm.gatewayProvider="openrouter"` | Default SaaS-style model gateway. |
| `AI_GATEWAY_API_KEY` | `llm.gatewayProvider="ai-gateway"` | Vercel AI Gateway compatible path. |
| `OPENAI_API_KEY` | `llm.gatewayProvider="openai"` | Used by the active OpenAI provider adapter. |

Optional observability/integration variables:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_POSTHOG_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` | Public analytics config. Safe to expose, but use separate projects per environment. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Use separate Sentry projects for staging and production. |
| `PROVIDER_KEYS_SECRET`, `HOOKS_TOKEN_SALT` | App runtime only, used by integration/provider key flows. |

## Configure overlay.config.json

Create `overlay.config.json` at the repo root or point `OVERLAY_CONFIG_FILE` to another path:

```bash
cp docs/config/onprem-minimal.example.json overlay.config.json
OVERLAY_CONFIG_FILE=overlay.config.json npm run dev
```

The normalized shape is:

| Section | Purpose |
| --- | --- |
| `app` | Base URL, deployment environment, CSP connect-src additions, and public env keys. |
| `auth` | WorkOS, OIDC, Keycloak, or no-op auth selection. |
| `billing` | Stripe or disabled billing. |
| `storage` | R2, S3, MinIO, or no-op object store. |
| `llm` | Gateway provider, provider key source, default model, and allowlist. |
| `database` | Convex URL/deployment and internal server secrets. |
| `capabilities` | Feature booleans consumed by browser UI and server route guards. |

Environment variables override JSON values. Use that for secrets in deployed environments. For example, keep `storage.s3.bucketName` in JSON but inject `S3_SECRET_ACCESS_KEY` from your runtime secret manager.

Validate a config before booting the app:

```bash
OVERLAY_CONFIG_FILE=overlay.config.json npm run check:config
npm run docs:check:self-hosting
```

## Deployment Profiles

Validated examples live under `docs/config`:

| Profile | File | Use case |
| --- | --- | --- |
| SaaS staging | [saas-staging.example.json](./config/saas-staging.example.json) | WorkOS, Stripe test mode, R2, OpenRouter, API key infrastructure enabled. |
| On-prem minimal | [onprem-minimal.example.json](./config/onprem-minimal.example.json) | No WorkOS, no Stripe, MinIO-compatible storage, no external LLM key. Good for shell and config smoke tests. |
| On-prem S3/OIDC/OpenAI | [onprem-s3-oidc-openai.example.json](./config/onprem-s3-oidc-openai.example.json) | Enterprise OIDC, S3-compatible storage, no billing, OpenAI model gateway. |

The examples contain placeholders only. Replace every `placeholder` or `replace_with` value before a real deployment.

## Provider Swaps

Auth providers:

| Provider | Config | Current status |
| --- | --- | --- |
| `workos` | `auth.workos` | Default SaaS path. Production-ready path for current hosted app. |
| `oidc` | `auth.oidc` | Runtime-config foundation. Verify sign-in, callback, token verification, and user mapping for your IdP before production. |
| `keycloak` | `auth.keycloak` | Keycloak-shaped OIDC foundation. Verify the same auth flows as OIDC. |
| `none` | none | Local/on-prem no-op auth. Pair with `capabilities.sso=false`. |

Billing providers:

| Provider | Config | Current status |
| --- | --- | --- |
| `stripe` | `billing.stripe` | SaaS checkout, portal, top-ups, webhooks. Pair with `capabilities.billing=true`. |
| `none` | none | No-op billing. Pair with `capabilities.billing=false`; billing UI and routes are hidden or blocked. |

Storage providers:

| Provider | Config | Current status |
| --- | --- | --- |
| `r2` | `storage.r2` | Cloudflare R2. Default SaaS storage. |
| `s3` | `storage.s3` | S3-compatible object store. Use for AWS S3 or compatible enterprise stores. |
| `minio` | `storage.s3` with `forcePathStyle=true` | Local/on-prem MinIO. |
| `none` | none | No-op object store. Use only when upload flows are intentionally unavailable. |

LLM providers:

| Provider | Config | Current status |
| --- | --- | --- |
| `openrouter` | `llm.gatewayProvider`, `OPENROUTER_API_KEY` | Default SaaS gateway path. |
| `ai-gateway` | `llm.gatewayProvider`, `AI_GATEWAY_API_KEY` | Vercel AI Gateway compatible path. |
| `openai` | `llm.gatewayProvider`, `OPENAI_API_KEY` | Active OpenAI adapter. |
| `anthropic`, `groq` | provider name only | Config shape exists, but the current server context selects the no-op adapter until those provider adapters are implemented. |
| `none` | none | No-op LLM provider for shell/config QA. |

Capabilities:

| Capability | Owns |
| --- | --- |
| `billing` | Checkout, portal, top-ups, billing account pages, quota purchase prompts. |
| `sso` | OAuth/SSO buttons, enterprise auth callbacks, native auth flows. |
| `apiKeys` | Future API key management routes and UI. |
| `webhooks` | Future webhook subscription routes and UI. |
| `vectorSearch` | Knowledge search and memory routes. Basic file listing is preserved. |
| `automations` | Automation scheduling, automation navigation, runner callbacks. |
| `multiTenant` | Reserved for future tenant isolation work. The schema rejects enabling it today. |

UI hiding is not an authorization boundary. Server routes also check capabilities and return deterministic `capability_disabled` responses when disabled.

## Build and Deploy Without Vercel

Overlay is a Next.js app plus Convex. You can run the web process anywhere that can run Node and reach your Convex and object storage endpoints.

Basic Node deployment:

```bash
npm ci
npm run build
OVERLAY_CONFIG_FILE=overlay.config.json npm run start
```

Set `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_CONVEX_URL` in the app runtime. If your host injects env vars at runtime, prefer env vars for secrets and keep non-secret provider shape in `overlay.config.json`.

Without Stripe:

```json
{
  "billing": { "provider": "none", "stripe": {} },
  "capabilities": { "billing": false }
}
```

Without WorkOS:

```json
{
  "auth": { "provider": "none", "allowDevFallbacks": false, "workos": {}, "oidc": {}, "keycloak": {} },
  "capabilities": { "sso": false }
}
```

With OIDC instead of WorkOS:

```json
{
  "auth": {
    "provider": "oidc",
    "allowDevFallbacks": false,
    "workos": {},
    "oidc": {
      "issuerUrl": "https://idp.enterprise.example.com",
      "clientId": "overlay-web",
      "clientSecret": "oidc_client_secret_placeholder",
      "audience": "overlay-api"
    },
    "keycloak": {}
  },
  "capabilities": { "sso": true }
}
```

## Docker Compose Example

This is a local shape for app plus MinIO. It does not include Convex because Convex remains a hosted deployment in the current architecture.

```yaml
services:
  web:
    image: node:22-bookworm
    working_dir: /app
    command: sh -c "npm ci && npm run build && npm run start"
    ports:
      - "3000:3000"
    volumes:
      - .:/app
    environment:
      OVERLAY_CONFIG_FILE: /app/overlay.config.json
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      NEXT_PUBLIC_CONVEX_URL: https://convex-local.example.com
      INTERNAL_API_SECRET: replace_with_local_internal_api_secret
      INTERNAL_SERVICE_AUTH_SECRET: replace_with_local_service_auth_secret
      SESSION_SECRET: replace_with_local_session_secret
      SESSION_TRANSFER_KEY: replace_with_local_transfer_key
      SESSION_COOKIE_ENCRYPTION_KEY: replace_with_local_cookie_key
    depends_on:
      - minio

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minio_access_key_placeholder
      MINIO_ROOT_PASSWORD: minio_secret_key_placeholder
    volumes:
      - minio-data:/data

volumes:
  minio-data:
```

Create the bucket from the MinIO console or CLI before testing upload flows:

```bash
mc alias set overlay-local http://localhost:9000 minio_access_key_placeholder minio_secret_key_placeholder
mc mb overlay-local/overlay-local
```

## Secrets Placement

App runtime only:

- `SESSION_SECRET`
- `SESSION_TRANSFER_KEY`
- `SESSION_COOKIE_ENCRYPTION_KEY`
- `INTERNAL_SERVICE_AUTH_SECRET`
- `API_KEY_HASH_SECRET`
- `PROVIDER_KEYS_SECRET`
- `HOOKS_TOKEN_SALT`
- WorkOS API key, OIDC client secret, Keycloak client secret
- Stripe secret key, Stripe webhook secret
- R2/S3/MinIO access key secrets
- LLM provider API keys

Convex:

- `INTERNAL_API_SECRET` must be set in Convex and must match the app runtime value for that deployment.
- If you intentionally run direct Convex auth/debug paths or Convex Stripe sync actions, also configure the corresponding WorkOS or Stripe variables in that Convex deployment. The BFF-first web path should not require session cookie secrets in Convex.

Public and safe to expose:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `DEV_NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_POSTHOG_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`
- Public CSP origins in `app.cspConnectSrc`

Values that must differ between staging and production:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT`
- `INTERNAL_API_SECRET`
- `INTERNAL_SERVICE_AUTH_SECRET`
- `SESSION_SECRET`
- `SESSION_TRANSFER_KEY`
- `SESSION_COOKIE_ENCRYPTION_KEY`
- `API_KEY_HASH_SECRET`
- WorkOS client/API credentials
- Stripe mode, keys, webhook secret, price IDs, and portal config
- R2/S3 buckets and access credentials
- LLM provider keys if you want separate billing/audit trails
- PostHog, Sentry, and analytics project identifiers

Do not copy production secrets into staging to "make it work". The config schema rejects several mixed staging/production combinations, but secret separation is still an operator responsibility.

## Convex Notes

Push Convex schema/function changes to the matching deployment:

```bash
npm run convex:push:dev
npm run convex:push:prod
```

For local web work against the dev Convex backend, prefer:

```bash
npm run dev:with-convex
```

Do not pass `.env.local` to production `convex deploy`; that file usually points at the dev slug. Use the package scripts so prod and dev deploys stay separate.

## Phase 5 API Route Cleanup Migration Notes

The `/api/app/*` compatibility surface has been removed. Clients must call `/api/v1/*`.

Required client changes:

- File content URLs must use `/api/v1/files/...`.
- Output content URLs must use `/api/v1/outputs/...` when output routes are present.
- Automation runner callbacks must use `/api/v1/automations/...`.
- Generated URLs from Convex must match the web route surface deployed in front of them.

Deployment ordering:

1. Deploy the web app that supports `/api/v1/*`.
2. Then push Convex functions that produce `/api/v1/*` URLs.
3. Do not push production Convex URL producer changes before the production web app supports those routes.

If staging points at the dev Convex deployment, keep staging web env and dev Convex producers aligned. If production points at prod Convex, keep production web env and prod Convex producers aligned.

## Verification

Programmatic checks:

```bash
npm run docs:check:self-hosting
npm run check:config
npm run typecheck
```

Minimal on-prem smoke:

```bash
cp docs/config/onprem-minimal.example.json overlay.config.json
OVERLAY_CONFIG_FILE=overlay.config.json npm run dev
```

Verify:

- App shell loads at `http://localhost:3000/app/chat`.
- Chat page renders. With `llm.gatewayProvider="none"`, message generation is intentionally unavailable until you configure an LLM provider.
- Settings loads at `http://localhost:3000/app/settings`. In the minimal no-auth profile it should show the normal sign-in gate with SSO buttons hidden.
- Redacted system/capability state is available at `http://localhost:3000/api/v1/capabilities` in non-production environments. `/api/v1/bootstrap` also includes redacted system state after normal app authentication.
- Billing, SSO, automations, webhooks, API key management, and vector search routes return clear disabled responses when their capabilities are false.
- File upload requires a signed-in user and the configured object store. With the minimal no-auth profile, upload routes should return `Unauthorized`; with MinIO enabled, create the bucket first before testing authenticated uploads.

If screenshots are added to this document later, verify they do not show secrets, API keys, private hostnames, or customer data.
