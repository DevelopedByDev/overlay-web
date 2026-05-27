# Secrets Management

## Source of Truth

All secrets for this project live in **Infisical**. That includes everything the team shares across `.env.local`, Convex deployments, and Vercel project envs.

- Project: [getoverlay-landing on Infisical](https://app.infisical.com/organizations/6b70ddb0-a373-4291-85ca-31e306ac4f95/projects/secret-management/de9c0e6d-f5f1-4cd4-9cc9-9cacad0bea53/overview)
- Environments: `dev`, `preview`, `prod`
- Config: `.infisical.json` (checked in) pins the project ID so CLI commands need no flags

Infisical is a **catalog**. There is no runtime SDK in the app and no auto-sync to Vercel or Convex. When a secret changes, you update it in Infisical first, then manually distribute it to the consumers below.

## First-Time Setup

Install the Infisical CLI:

```bash
brew install infisical/get-cli/infisical
```

(If brew isn't available, see https://infisical.com/docs/cli/overview for alternatives.)

Authenticate once:

```bash
npm run secrets:login
```

This opens a browser. Pick the org `6b70ddb0-a373-4291-85ca-31e306ac4f95`.

## Pulling Secrets for Local Dev

```bash
npm run secrets:pull
```

This overwrites `.env.local` with the `dev` environment from Infisical. Run it whenever someone tells you a secret rotated, or any time `next dev` starts failing with auth/provider errors.

> Do **not** hand-edit `.env.local` for shared secrets — it'll get clobbered on the next pull. If you genuinely need a personal override, create `.env.local.override` and load it manually; it is gitignored by the `.env*` rule.

## Distributing to Vercel (manual, per environment)

For each secret that changed in Infisical, push it to Vercel. Two options:

**Dashboard** (fastest for a single secret):
- Open the Vercel project → Settings → Environment Variables
- Paste the value into the matching `Preview` or `Production` slot

**CLI** (better for batches):

```bash
# pipe a single key out of Infisical and into Vercel:
infisical secrets get KEY_NAME --env=preview --plain | vercel env add KEY_NAME preview
infisical secrets get KEY_NAME --env=prod --plain    | vercel env add KEY_NAME production
```

You can also dump an entire environment to stdout and copy-paste:

```bash
npm run secrets:pull:preview   # prints dotenv for preview
npm run secrets:pull:prod      # prints dotenv for prod
```

These print to stdout (no file write) on purpose — there is no scenario where you should write preview/prod secrets to `.env.local`.

## Distributing to Convex (manual, per deployment)

Only some keys belong in Convex — the ones consumed inside Convex functions (server actions). Roughly:

- **Belongs in Convex**: `WORKOS_*`, `STRIPE_*`, `PROVIDER_KEYS_SECRET`, `INTERNAL_API_SECRET`, `CHAT_STREAM_RELAY_SECRET`, `R2_*`, `DAYTONA_*`, `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `COMPOSIO_API_KEY`, `BROWSER_USE_API_KEY`, `NVIDIA_API_KEY`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `HOOKS_TOKEN_SALT`
- **Does NOT belong in Convex**: `NEXT_PUBLIC_*` (those are baked into the Next.js bundle), `SESSION_*` (Next.js session crypto), `STRIPE_*_PRICE_ID` if only the Next.js side reads them

Push to the dev deployment:

```bash
npx convex env set KEY_NAME "value"
```

Push to prod (matches the convention in `convex:push:prod`):

```bash
CONVEX_DEPLOYMENT=prod:colorful-chickadee-419 npx convex env set KEY_NAME "value"
```

List what's currently set so you can spot drift:

```bash
npx convex env list
CONVEX_DEPLOYMENT=prod:colorful-chickadee-419 npx convex env list
```

## Workflow Summary

When a secret rotates or a new one is added:

1. **Update Infisical first** (web UI). Set the value in `dev`, `preview`, and `prod` as appropriate.
2. **Add the key name to `.env.example`** if it's new, so the inventory stays accurate.
3. **Pull locally**: `npm run secrets:pull`. Confirm `next dev` still boots.
4. **Push to Vercel** for `preview` and `production` (dashboard or CLI, per above).
5. **Push to Convex** if the key is server-side (dev deployment + prod deployment).
6. **Trigger redeploys** if Vercel needs to pick up the new envs (env changes don't auto-redeploy).

## What Lives Where

| Layer | Source | How it's loaded |
|---|---|---|
| Local Next.js dev | `.env.local` (pulled from Infisical) | Next.js auto-loads |
| Local Convex dev | `npx convex env set` (manually mirrored) | Convex runtime |
| Vercel Preview / Prod | Vercel project envs (manually mirrored) | Vercel injects at build + runtime |
| Convex Prod | `CONVEX_DEPLOYMENT=prod:... convex env set` | Convex runtime |
| Infisical | Web UI | Catalog only — nothing reads it at runtime |
