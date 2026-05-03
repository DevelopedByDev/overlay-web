# Self-Hosting Guide

Complete guide for deploying your own Overlay instance.

## Table of Contents

1. [Architecture](#architecture)
2. [Core Services (Required)](#core-services-required)
3. [Optional Services](#optional-services)
4. [Environment Variables](#environment-variables)
5. [Deployment](#deployment)
6. [Verification](#verification)

---

## Architecture

| Component | Technology | Required? |
|-----------|-----------|-----------|
| Frontend & API | Next.js 15 | Yes |
| Backend & Database | Convex | Yes |
| Authentication | WorkOS | Yes |
| AI Inference | Vercel AI Gateway (or OpenRouter/Groq) | Yes (at least one) |
| Billing | Stripe | No |
| File Storage | Cloudflare R2 | No |
| Integrations | Composio | No |
| Browser Automation | Browser Use | No |
| Code Sandboxes | Daytona | No |
| Monitoring | Sentry/PostHog | No |

---

## Core Services (Required)

### 1. Convex (Backend)

Convex runs your database, queries, mutations, scheduled jobs, and HTTP routes.

**Setup:**
1. Sign up at [convex.dev](https://convex.dev)
2. Install CLI: `npm install convex && npx convex login`
3. Create two deployments (prod + dev):
   ```bash
   npx convex dev --once
   npx convex deploy
   ```
4. Note the URLs: `https://<slug>.convex.cloud` and `https://<slug>.convex.site`

**Set Convex environment variables** (run these after creating deployments):
```bash
npx convex env set INTERNAL_API_SECRET "$(openssl rand -hex 32)"
npx convex env set PROVIDER_KEYS_SECRET "$(openssl rand -hex 32)"
npx convex env set HOOKS_TOKEN_SALT "$(openssl rand -hex 32)"
npx convex env set WORKOS_API_KEY "sk_..."
npx convex env set WORKOS_CLIENT_ID "client_..."
npx convex env set SESSION_TRANSFER_KEY "$(openssl rand -hex 32)"
npx convex env set SESSION_COOKIE_ENCRYPTION_KEY "$(openssl rand -hex 32)"
```

**Generate secrets locally** (for `.env.local`):
```bash
export SESSION_SECRET=$(openssl rand -hex 32)
export SESSION_TRANSFER_KEY=$(openssl rand -hex 32)
export SESSION_COOKIE_ENCRYPTION_KEY=$(openssl rand -hex 32)
export INTERNAL_API_SECRET=$(openssl rand -hex 32)
export INTERNAL_SERVICE_AUTH_SECRET=$(openssl rand -hex 32)
export PROVIDER_KEYS_SECRET=$(openssl rand -hex 32)
export HOOKS_TOKEN_SALT=$(openssl rand -hex 32)
```

---

### 2. WorkOS (Authentication)

Enterprise-grade auth and SSO.

**Setup:**
1. Sign up at [workos.com](https://workos.com)
2. Create an organization
3. Configure redirect URIs:
   - Prod: `https://your-domain.com/api/auth/callback`
   - Dev: `http://localhost:3000/api/auth/callback`
4. Get credentials:
   - `WORKOS_CLIENT_ID` (e.g., `client_...`)
   - `WORKOS_API_KEY` (e.g., `sk_...`)
5. Create separate dev credentials (recommended)

---

### 3. AI Provider (At least one required)

#### Vercel AI Gateway (Recommended)

The **primary** AI provider for Overlay. Vercel AI Gateway provides a unified interface to 20+ providers including OpenAI, Anthropic, Google, xAI, Groq, Cohere, Mistral, and more.

**Setup:**
1. Sign up at [vercel.com](https://vercel.com) and create a project
2. Enable AI Gateway in your project settings
3. Add provider API keys in the AI Gateway dashboard (for providers you want to use)
4. Copy your Gateway API key (starts with `vgw_`)
5. Set `AI_GATEWAY_API_KEY` in your environment

**Providers you can route through AI Gateway:**
- OpenAI (GPT-4, GPT-4o, o1, etc.)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, etc.)
- Google (Gemini 1.5 Pro, Gemini 1.5 Flash)
- xAI (Grok)
- Groq (Llama 3, Mixtral - fast inference)
- Cohere, Mistral, Perplexity, and more

**Benefits:**
- Single API key for multiple providers
- Built-in caching, rate limiting, and observability
- Automatic fallback between providers
- Unified request/response format

---

#### OpenRouter (Alternative)
- Sign up: [openrouter.ai](https://openrouter.ai)
- Get API key
- Provides access to 200+ models including GPT, Claude, Gemini, Grok, DeepSeek, etc.
- Set `OPENROUTER_API_KEY`

#### Groq (Optional supplement)
- Sign up: [groq.com](https://groq.com)
- Get API key for ultra-fast inference on open models
- Set `GROQ_API_KEY`

#### NVIDIA (Free tier available)
- Sign up: [build.nvidia.com](https://build.nvidia.com)
- Free access to DeepSeek V3.2, Kimi K2 Thinking
- Set `NVIDIA_API_KEY`

---

## Optional Services

### Stripe (Billing)

1. Sign up at [stripe.com](https://stripe.com)
2. Create products:
   - Pro: `$20/month` (lookup key: `pro_monthly`)
   - Max: `$100/month` (lookup key: `max_monthly`)
   - Top-up credits: one-time payment
3. Note Price IDs: `price_...`
4. Create Customer Portal config (Settings → Customer Portal)
5. Get API keys:
   - Test mode: `sk_test_...`
   - Live mode: `sk_live_...`
6. Set up webhook endpoint: `https://your-domain.com/api/webhooks/stripe`

**For local dev:**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Stripe Variables Needed:**
- `STRIPE_SECRET_KEY` / `DEV_STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` / `DEV_STRIPE_WEBHOOK_SECRET`
- `STRIPE_PAID_UNIT_PRICE_ID` / `DEV_STRIPE_PAID_UNIT_PRICE_ID`
- `STRIPE_TOPUP_UNIT_PRICE_ID` / `DEV_STRIPE_TOPUP_UNIT_PRICE_ID`
- `STRIPE_PORTAL_CONFIGURATION_ID` / `DEV_STRIPE_PORTAL_CONFIGURATION_ID`

---

### Cloudflare R2 (File Storage)

For knowledge base file uploads and generated media storage.

1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Go to R2 → Create bucket
3. Go to R2 → Manage R2 API Tokens → Create
4. Note:
   - Account ID
   - Bucket name
   - Access Key ID + Secret Access Key
5. Set `S3_API` to your R2 S3-compatible endpoint (e.g., `https://<account>.r2.cloudflarestorage.com`)

**R2 Variables:**
- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_GLOBAL_BUDGET_BYTES` (optional budget limit)
- `R2_PRESIGN_TTL_SECONDS` (default: 3600)
- `S3_API`

---

### Composio (App Integrations)

For 100+ external app integrations (Gmail, Notion, GitHub, etc.).

1. Sign up at [composio.dev](https://composio.dev)
2. Generate API key
3. Set `COMPOSIO_API_KEY`

---

### Browser Use (Browser Automation)

For AI-controlled browser tasks.

1. Sign up at [browser-use.com](https://browser-use.com)
2. Get API key
3. Set `BROWSER_USE_API_KEY`

---

### Daytona (Code Execution)

For running code in sandboxed environments.

1. Sign up at [daytona.io](https://daytona.io)
2. Get API key and API URL
3. Set `DAYTONA_API_KEY` and `DAYTONA_API_URL`

---

### Sentry (Error Tracking)

1. Sign up at [sentry.io](https://sentry.io)
2. Create a project
3. Get DSN and auth token
4. Set:
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN` (same as above)
   - `SENTRY_AUTH_TOKEN`
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`

---

### PostHog (Analytics)

1. Sign up at [posthog.com](https://posthog.com)
2. Get project API key and host
3. Set:
   - `NEXT_PUBLIC_POSTHOG_TOKEN`
   - `NEXT_PUBLIC_POSTHOG_HOST` (e.g., `https://us.i.posthog.com`)

---

## Environment Variables

### Required

```bash
# Convex
NEXT_PUBLIC_CONVEX_URL=https://<prod-slug>.convex.cloud
DEV_NEXT_PUBLIC_CONVEX_URL=https://<dev-slug>.convex.cloud
CONVEX_DEPLOYMENT=<deployment-name>
NEXT_PUBLIC_CONVEX_SITE_URL=https://<prod-slug>.convex.site

# App URLs
NEXT_PUBLIC_APP_URL=https://your-domain.com
DEV_NEXT_PUBLIC_APP_URL=http://localhost:3000

# WorkOS
WORKOS_CLIENT_ID=client_...
WORKOS_API_KEY=sk_...
DEV_WORKOS_CLIENT_ID=client_...
DEV_WORKOS_API_KEY=sk_...

# Secrets (generate with: openssl rand -hex 32)
SESSION_SECRET=<64-char-hex>
SESSION_TRANSFER_KEY=<64-char-hex>
SESSION_COOKIE_ENCRYPTION_KEY=<64-char-hex>
INTERNAL_API_SECRET=<64-char-hex>
INTERNAL_SERVICE_AUTH_SECRET=<64-char-hex>
PROVIDER_KEYS_SECRET=<64-char-hex>
HOOKS_TOKEN_SALT=<64-char-hex>

# AI (at least one required)
AI_GATEWAY_API_KEY=vgw_...
# Or alternatives:
# OPENROUTER_API_KEY=sk-or-...
# GROQ_API_KEY=gsk_...
# NVIDIA_API_KEY=nvapi-...
```

### Optional

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PAID_UNIT_PRICE_ID=price_...
STRIPE_TOPUP_UNIT_PRICE_ID=price_...
STRIPE_PORTAL_CONFIGURATION_ID=bpc_...
DEV_STRIPE_SECRET_KEY=sk_test_...
DEV_STRIPE_WEBHOOK_SECRET=whsec_...
DEV_STRIPE_PAID_UNIT_PRICE_ID=price_...
DEV_STRIPE_TOPUP_UNIT_PRICE_ID=price_...
DEV_STRIPE_PORTAL_CONFIGURATION_ID=bpc_...

# Integrations
COMPOSIO_API_KEY=
BROWSER_USE_API_KEY=

# R2 Storage
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=overlay-files
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_GLOBAL_BUDGET_BYTES=1099511627776  # 1TB default
R2_PRESIGN_TTL_SECONDS=3600
S3_API=https://<account>.r2.cloudflarestorage.com

# Daytona
DAYTONA_API_KEY=
DAYTONA_API_URL=https://app.daytona.io/api

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=$SENTRY_DSN
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org
SENTRY_PROJECT=overlay
NEXT_PUBLIC_POSTHOG_TOKEN=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

---

## Deployment

### Local Development

```bash
# 1. Clone and install
git clone <repo>
cd overlay-landing
npm install

# 2. Copy env file and fill it out
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Push Convex backend
npm run convex:push:dev   # or :all for both

# 4. Run dev server
npm run dev
```

### Production

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Deploy to your host** (Vercel recommended):
   ```bash
   # Vercel CLI
   vercel --prod
   ```

3. **Push Convex to production:**
   ```bash
   npm run convex:push:prod
   ```

4. **Configure Convex env vars** in production (see Core Services section)

5. **Set Stripe webhook** to your production URL

---

## Verification

### Quick Checklist

- [ ] Convex dev + prod deployments created
- [ ] Convex env vars set (run `npx convex env list` to verify)
- [ ] `.env.local` created with all required variables
- [ ] WorkOS redirect URIs configured
- [ ] At least one AI provider key set
- [ ] App runs locally: `npm run dev`
- [ ] Login flow works
- [ ] Chat responds to messages

### Full Feature Checklist (Optional Services)

- [ ] Stripe products created and webhook configured
- [ ] R2 bucket created with API token
- [ ] Composio connected (test an integration)
- [ ] Browser Use connected (test browser automation)
- [ ] Daytona connected (test code execution)
- [ ] Sentry receiving errors
- [ ] PostHog receiving events

### Testing Commands

```bash
# Verify Convex connection
npx convex dev

# Check env vars
npx convex env list

# Test build
npm run build

# Run lint
npm run lint
```

---

## Troubleshooting

### "MissingAccessToken" error
Do not pass `.env.local` to `convex deploy`. Run plain `npx convex deploy` or `npm run convex:push:prod`.

### Session issues
Ensure `SESSION_SECRET`, `SESSION_TRANSFER_KEY`, and `SESSION_COOKIE_ENCRYPTION_KEY` match between Next.js and Convex environments.

### Webhook failures
Verify `STRIPE_WEBHOOK_SECRET` matches the secret from your Stripe webhook configuration.

---

## Security Notes

- Never commit `.env.local` or any file with real secrets
- Rotate all generated secrets before sharing your repo
- Treat `NEXT_PUBLIC_*` values as public (they're embedded in the client bundle)
- Keep `PROVIDER_KEYS_SECRET` and other server secrets strictly confidential
- Review `SECURITY.md` for full security guidance

---

*Last updated: May 2026*
