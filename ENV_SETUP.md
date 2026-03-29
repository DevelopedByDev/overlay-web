# Environment Setup

This document is safe for a public repository. Replace every hostname, deployment slug,
and secret below with values that belong to your own environment.

Start with `.env.example`, then fill in the environment files for the surfaces you use.

## Web App (`overlay-landing/.env.local`)

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-prod-deployment.convex.cloud
DEV_NEXT_PUBLIC_CONVEX_URL=https://your-dev-deployment.convex.cloud

# App URLs
NEXT_PUBLIC_APP_URL=https://your-public-app.example.com
DEV_NEXT_PUBLIC_APP_URL=https://your-preview-app.example.com

# Auth / server-to-server secrets
SESSION_SECRET=replace-with-a-long-random-secret
INTERNAL_API_SECRET=replace-with-another-long-random-secret
SESSION_TRANSFER_KEY=replace-with-a-third-random-secret
SESSION_COOKIE_ENCRYPTION_KEY=replace-with-a-fourth-random-secret
PROVIDER_KEYS_SECRET=replace-with-a-fifth-random-secret
HOOKS_TOKEN_SALT=replace-with-a-sixth-random-secret

# Optional integrations
AI_GATEWAY_API_KEY=vgw_...
WORKOS_CLIENT_ID=client_...
WORKOS_API_KEY=sk_...
```

## Mobile App (`overlay-mobile/.env`)

```bash
EXPO_PUBLIC_AUTH_BASE_URL=https://your-public-app.example.com
EXPO_PUBLIC_CONVEX_URL=https://your-prod-deployment.convex.cloud
```

## Desktop / Electron App (`.env`)

```bash
VITE_CONVEX_URL=https://your-prod-deployment.convex.cloud
VITE_WORKOS_CLIENT_ID=client_...
```

## Convex Environment Variables

Set the same sensitive values in Convex that your backend needs directly:

```bash
npx convex env set INTERNAL_API_SECRET "replace-with-a-long-random-secret"
npx convex env set PROVIDER_KEYS_SECRET "replace-with-a-dedicated-provider-export-secret"
npx convex env set HOOKS_TOKEN_SALT "replace-with-a-random-hooks-token-salt"
npx convex env set WORKOS_API_KEY "sk_..."
npx convex env set WORKOS_CLIENT_ID "client_..."
```

Production deployments must also set `SESSION_TRANSFER_KEY` and
`SESSION_COOKIE_ENCRYPTION_KEY` in the web environment. In development only, the app can
temporarily fall back to the legacy secrets while you rotate.

Rotate every real secret in your local env files before sharing the repository with anyone
outside your trusted team.

If you edit files inside `convex/`, push both deployments:

```bash
npm run convex:push:all
```

## Stripe Setup

Recommended lookup keys:

| Product | Lookup Key | Price | Type |
| --- | --- | --- | --- |
| Pro | `pro_monthly` | $20/month | Subscription |
| Max | `max_monthly` | $100/month | Subscription |

Webhook endpoint example:

```text
https://your-public-app.example.com/api/webhooks/stripe
```

For local development:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## WorkOS / Vault Setup

If you use WorkOS Vault for provider credentials, create secrets for the providers you
enable and point Convex at those object IDs.

```bash
VAULT_ANTHROPIC_KEY_ID=api-key-anthropic
VAULT_OPENAI_KEY_ID=api-key-openai
VAULT_GOOGLE_KEY_ID=api-key-google
VAULT_GROQ_KEY_ID=api-key-groq
VAULT_XAI_KEY_ID=api-key-xai
VAULT_OPENROUTER_KEY_ID=api-key-openrouter
```

## Quick Checklist

- [ ] Copy `.env.example` into your local env files
- [ ] Create separate Convex prod and dev deployments
- [ ] Set `SESSION_SECRET`, `INTERNAL_API_SECRET`, `SESSION_TRANSFER_KEY`, and `SESSION_COOKIE_ENCRYPTION_KEY`
- [ ] Set `PROVIDER_KEYS_SECRET` and `HOOKS_TOKEN_SALT`
- [ ] Configure Stripe products and the Stripe webhook
- [ ] Configure WorkOS auth and any Vault-backed provider keys
- [ ] Run `npm run dev`
- [ ] Run `npm run convex:push:all` after backend changes
