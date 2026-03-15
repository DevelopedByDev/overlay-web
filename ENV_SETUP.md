# Environment Variables Setup

## Landing Page (`overlay-landing/.env.local`)

### Required Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...          # From Stripe Dashboard > API keys
STRIPE_WEBHOOK_SECRET=whsec_...        # From Stripe Dashboard > Webhooks

# Convex Configuration
NEXT_PUBLIC_CONVEX_URL=https://different-caiman-77.convex.cloud  # Your Convex deployment URL

# App URLs
NEXT_PUBLIC_APP_URL=https://getoverlay.io
DEV_NEXT_PUBLIC_APP_URL=https://your-overlay-dev.vercel.app   # Use your Vercel development deployment for auth in local dev
```

## Mobile App (`overlay-mobile/.env`)

```bash
EXPO_PUBLIC_AUTH_BASE_URL=https://your-overlay-dev.vercel.app
EXPO_PUBLIC_CONVEX_URL=https://different-caiman-77.convex.cloud
```

### Setting Up Stripe Products

Your Stripe products should have the following **lookup keys** configured:

| Product | Lookup Key | Price | Type |
|---------|------------|-------|------|
| Pro | `pro_monthly` | $20/month | Subscription |
| Max | `max_monthly` | $100/month | Subscription |

To add lookup keys:
1. Go to Stripe Dashboard > Products
2. Click on each product > Edit price
3. Add the lookup key in the "Lookup key" field

### Setting Up Stripe Webhooks

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

For local development, use Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Convex Backend (`convex/.env.local`)

```bash
# WorkOS Configuration (for API key fetching)
WORKOS_API_KEY=sk_...                  # WorkOS API key
WORKOS_CLIENT_ID=client_...            # WorkOS Client ID

# Vault Object IDs (optional - defaults are used if not set)
VAULT_ANTHROPIC_KEY_ID=api-key-anthropic
VAULT_OPENAI_KEY_ID=api-key-openai
VAULT_GOOGLE_KEY_ID=api-key-google
VAULT_GROQ_KEY_ID=api-key-groq
VAULT_XAI_KEY_ID=api-key-xai
VAULT_OPENROUTER_KEY_ID=api-key-openrouter
```

### Setting Up WorkOS Vault

1. Go to WorkOS Dashboard > Vault
2. Create secrets for each API key:
   - `api-key-anthropic` → Your Anthropic API key
   - `api-key-openai` → Your OpenAI API key
   - `api-key-google` → Your Google AI API key
   - `api-key-groq` → Your Groq API key
   - `api-key-xai` → Your xAI API key
   - `api-key-openrouter` → Your OpenRouter API key

To set Convex environment variables:
```bash
npx convex env set WORKOS_API_KEY sk_...
npx convex env set WORKOS_CLIENT_ID client_...
```

---

## Electron App (`.env`)

The Electron app will fetch API keys from WorkOS Vault via Convex, so you only need:

```bash
# Convex Configuration
VITE_CONVEX_URL=https://different-caiman-77.convex.cloud

# WorkOS Auth (already configured)
VITE_WORKOS_CLIENT_ID=client_...
```

---

## Quick Start Checklist

- [ ] Create Stripe products with lookup keys
- [ ] Set up Stripe webhook endpoint
- [ ] Add API keys to WorkOS Vault
- [ ] Set Convex environment variables
- [ ] Update `.env.local` in landing page
- [ ] Test with Stripe CLI locally
