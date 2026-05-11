---
title: "Configuration"
description: "Complete reference for overlay.config.json and environment variables."
---

# Configuration

Overlay can be configured via environment variables (always required) and an optional `overlay.config.json` file for fine-grained tuning.

## Environment Variables

### Required Core

| Variable | Description | Example |
|----------|-------------|---------|
| `SESSION_SECRET` | HMAC key for cookie signing | `random-64-char-string` |
| `INTERNAL_API_SECRET` | Service-to-service auth | `random-64-char-string` |
| `SESSION_TRANSFER_KEY` | Native app session encryption | `random-64-char-string` |
| `SESSION_COOKIE_ENCRYPTION_KEY` | Cookie payload encryption | `random-64-char-string` |
| `PROVIDER_KEYS_SECRET` | Provider credential encryption | `random-64-char-string` |
| `HOOKS_TOKEN_SALT` | Webhook token derivation | `random-64-char-string` |

### Auth

| Variable | Description | Example |
|----------|-------------|---------|
| `WORKOS_CLIENT_ID` | WorkOS AuthKit client ID | `client_...` |
| `WORKOS_API_KEY` | WorkOS API key | `sk_...` |
| `OVERLAY_ADMIN_USER_IDS` | Comma-separated admin WorkOS user IDs | `user_abc,user_xyz` |

### Database

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex production deployment | `https://abc.convex.cloud` |
| `DEV_NEXT_PUBLIC_CONVEX_URL` | Convex development deployment | `https://xyz.convex.cloud` |

### Storage

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account ID | `abc123` |
| `R2_ACCESS_KEY_ID` | R2 API token ID | `abc` |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret | `xyz` |
| `R2_BUCKET_NAME` | Object storage bucket | `overlay-files` |

### AI / Billing

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe API key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key | `vgw_...` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-...` |
| `COMPOSIO_API_KEY` | Composio integration key | `abc` |
| `BROWSER_USE_API_KEY` | Browser-use tool key | `abc` |

### Optional Integrations

| Variable | Description | Example |
|----------|-------------|---------|
| `SENTRY_DSN` | Error tracking | `https://...@sentry.io/...` |
| `POSTHOG_KEY` | Product analytics | `phc_...` |
| `DAYTONA_API_KEY` | Sandbox execution | `dt_...` |
| `VAULT_*_KEY_ID` | WorkOS Vault provider key IDs | `api-key-openai` |

## overlay.config.json

Create `overlay.config.json` in the project root (checked into version control, no secrets):

```json
{
  "$schema": "https://getoverlay.io/schema/config/v1.json",
  "version": "1.0.0",
  "deployment": {
    "mode": "self-hosted",
    "domain": "overlay.company.com",
    "tls": "auto"
  },
  "auth": {
    "provider": "workos",
    "sessionTTLMinutes": 10080,
    "mfaRequired": false,
    "allowedRedirectOrigins": [
      "https://overlay.company.com/auth/native/callback"
    ]
  },
  "ai": {
    "gateway": "vercel",
    "fallbackProvider": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "defaultModel": "llama3.1:8b"
    },
    "modelTiering": {
      "free": ["openrouter/free", "nvidia/nemotron-nano-9b-v2"],
      "cheap": ["gemini-3-flash-preview", "openai/gpt-5.4-mini"],
      "premium": ["claude-opus-4-6", "gpt-5.4"]
    }
  },
  "billing": {
    "provider": "stripe",
    "currency": "usd",
    "markupBasisPoints": 2500,
    "autoTopUp": {
      "enabled": true,
      "thresholdCents": 500,
      "amountCents": 2000
    }
  },
  "storage": {
    "provider": "minio",
    "publicUrlTtlSeconds": 3600,
    "maxUploadSizeBytes": 104857600
  },
  "rateLimit": {
    "auth": { "windowMs": 60000, "maxRequests": 10 },
    "ai": { "windowMs": 60000, "maxRequests": 30 },
    "storage": { "windowMs": 60000, "maxRequests": 60 }
  },
  "security": {
    "cspEnforce": true,
    "allowedFrameAncestors": [],
    "sessionCookie": {
      "secure": true,
      "httpOnly": true,
      "sameSite": "lax"
    }
  },
  "whiteLabel": {
    "logoUrl": "/assets/logo.svg",
    "faviconUrl": "/assets/favicon.svg",
    "primaryColor": "#0A0A0A",
    "appName": "Overlay"
  }
}
```

### Schema Notes

- `deployment.mode`: `"saas"`, `"self-hosted"`, or `"hybrid"`
- `auth.provider`: `"workos"`, `"keycloak"`, `"saml"`, or `"oidc"`
- `ai.gateway`: `"vercel"`, `"ollama"`, or `"vllm"`
- `storage.provider`: `"r2"`, `"minio"`, or `"s3"`
- All paths in `whiteLabel` are relative to `/public/`

## Self-Hosted vs SaaS Differences

| Concern | SaaS | Self-Hosted |
|---------|------|-------------|
| Database | Convex cloud | Postgres + Redis |
| Auth | WorkOS AuthKit | Keycloak / SAML |
| Storage | Cloudflare R2 | MinIO |
| AI | Vercel AI Gateway | Ollama / vLLM |
| Billing | Stripe | Stripe (or disabled) |
| Hosting | Vercel | Docker / K8s |

## Secret Management

**Never commit secrets.** Use one of:

- **Kubernetes**: `kubectl create secret generic overlay-secrets --from-env-file=.env.local`
- **Docker Compose**: `.env.local` file mounted as env file
- **HashiCorp Vault**: Inject via `vault-env` sidecar
- **AWS Secrets Manager**: Mount via `external-secrets` operator

Rotate all secrets every 90 days or on team member offboarding.
