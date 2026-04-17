# Security Actions — Overlay (damascus)

Things you need to do on dashboards or in environment variable settings.
Updated: 2026-04-16.

---

## STATUS KEY
- ✅ Done
- 🔲 Needs your action
- ⏳ In progress / deferred (architectural)

---

## P0 — Critical (fix immediately)

### P0-1  Remove `getAPIKey` Convex action ✅
No action needed — code deleted. Key was orphaned.

### P0-2  `createSubscriptionCheckout` accepts arbitrary userId ✅
No action needed — code deleted. Real checkout flow was already server-side.

### P0-3  Stripe webhook credits come from client metadata ✅
No action needed — webhook now uses `session.amount_total`.

### P0-4  Webhook event replay possible ✅
No action needed — dedup table added in code.

### P0-5  LLM-controlled sandbox command string ✅
No action needed — app-side blocklist added. Still do P1-6 (Daytona egress).

### P0-6  `Math.random()` used for file IDs ✅
No action needed — replaced with `crypto.randomBytes`.

### P0-7  Session encryption keys share `INTERNAL_API_SECRET` ✅ (code) 🔲 (env)
**You must set these in Vercel (and all environments):**

```
SESSION_TRANSFER_KEY   = $(openssl rand -hex 32)
SESSION_COOKIE_ENCRYPTION_KEY = $(openssl rand -hex 32)
```

Rules:
- Must be ≥ 32 characters
- Must differ from each other
- Must differ from `INTERNAL_API_SECRET`
- Rotating `SESSION_COOKIE_ENCRYPTION_KEY` logs everyone out (expected)

---

## P0 — Cleanup  (provider key rotation)

Because `getAPIKey` previously returned raw keys to any caller with the shared
secret, rotate these as a precaution:

| Key | Where to rotate |
|-----|----------------|
| `GROQ_API_KEY` | console.groq.com → API Keys |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys |
| `COMPOSIO_API_KEY` | app.composio.dev → Settings |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway dashboard |

After rotating, update the new values in:
1. **WorkOS Vault** (dashboard.workos.com → Vault) — update the vault objects `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `COMPOSIO_API_KEY`, `AI_GATEWAY_API_KEY`
2. **Vercel environment variables** — update same keys as a fallback

Also **delete** these (now unused):
- Vercel: `PROVIDER_KEYS_SECRET`, `NEXT_PUBLIC_MIXPANEL_TOKEN`, `NEXT_PUBLIC_MIXPANEL_API_HOST`, `MINIMAX_API_KEY`
- WorkOS Vault: delete vault objects `MIXPANEL_TOKEN` and `MINIMAX_API_KEY`

---

## P1 — High (fix this sprint)

### P1-1  Stripe customer cross-linking ✅ (code)
No dashboard action needed.

### P1-2  Free-tier daily limits client-side only ✅ (code)
No dashboard action needed.

### P1-3  Static `INTERNAL_API_SECRET` instead of short-lived tokens ⏳
**Architectural project — not yet implemented.**  
Current gap: `INTERNAL_API_SECRET` is a long-lived static secret. If leaked,
it gives permanent internal service auth.

Recommended path (tracked separately):
1. Provision an AWS KMS key (or Cloudflare KMS / GCP KMS)
2. Issue short-TTL (≤60s) service JWTs signed by the KMS key
3. Convex verifies signature + expiry + per-nonce dedup

**Interim mitigations already in place:**
- The secret is never exposed to clients
- `HMAC-SHA256` comparison in `convex/lib/auth.ts` is constant-time
- Rotate `INTERNAL_API_SECRET` any time a Vercel preview env is reset or a
  team member departs

**Your action now:** Ensure `INTERNAL_API_SECRET` is set in Vercel
production, staging, and preview environments with a strong random value:
```
INTERNAL_API_SECRET = $(openssl rand -hex 32)
```

### P1-4  Refresh-token rate-limit key leaks plaintext token ✅ (code)
No action needed.

### P1-5  `rehype-raw` enables stored XSS in markdown ✅ (code)
No action needed — `rehype-raw` removed.

### P1-6  Daytona sandbox egress operator-controlled 🔲
**You must configure this in the Daytona dashboard.**

In your Daytona workspace template settings, configure:
- **Egress allowlist**: npm registry (`registry.npmjs.org`), PyPI
  (`pypi.org`, `files.pythonhosted.org`), GitHub (`github.com`, `raw.githubusercontent.com`)
- **Block** RFC1918 + link-local + IMDS:
  `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `127.0.0.1/8`
- Set **per-sandbox CPU/memory/time limits**
  (e.g., 2 CPU, 2 GiB RAM, 15-min wall-clock max)

Verification: run `curl http://169.254.169.254/` inside a sandbox and assert it fails.

### P1-7  `authDebug.ts` endpoints exist in production ✅ (code)
No action needed — endpoint now throws in production.

### P1-8  `purgeKnowledgeSource` lacks userId guard ✅ (code)
No action needed.

### P1-9  JWKS cache TTL 10 minutes ✅ (code)
No action needed — reduced to 2 minutes.

### P1-10  Automations: no per-user execution cap ✅ (code)
No action needed — 50-automation cap enforced at creation.

---

## P2 — Medium ✅ implemented

### P2-1  `returnUrl` not validated for open-redirect ✅
`convex/stripe.ts` — `createBillingPortalSession` now validates `returnUrl`
against an allowlist. Next.js checkout routes were already safe (server-anchored
`baseUrl`). Add any additional allowed origins via `APP_URL` / `NEXT_PUBLIC_APP_URL`
env vars (already read by the validator).

### P2-2  Hardcoded third-party URLs ✅
- `convex/knowledge.ts` — AI Gateway embed URL now reads `AI_GATEWAY_EMBED_URL`
  env var, falling back to the hardcoded value.
- `convex/lib/auth.ts` — WorkOS JWKS base URL now reads `WORKOS_JWKS_BASE_URL`
  env var, falling back to `https://api.workos.com`.

**Optional env vars** (set if you want to override defaults):
```
AI_GATEWAY_EMBED_URL=https://ai-gateway.vercel.sh/v1/embeddings
WORKOS_JWKS_BASE_URL=https://api.workos.com
```

### P2-3  R2 presigned URL TTL ✅
`src/lib/r2.ts` — TTL is now clamped to a maximum of 900 seconds (15 minutes)
regardless of `R2_PRESIGN_TTL_SECONDS`. Default is 300 s (5 min).

### P2-4  SVG / HTML uploads not blocked ✅
Both `src/app/api/app/files/upload-url/route.ts` and `.../presign/route.ts`
now reject `image/svg+xml`, `text/html`, `application/xhtml+xml`,
`application/javascript`, `text/javascript` with HTTP 415.

### P2-5  Mass-assignment via `db.patch(id, args)` ✅ (audited, clean)
Grep found two hits, both using explicitly-constructed `payload` objects.
No raw arg spreading. No changes needed.

### P2-6  Subscription `tier` from client-supplied webhook metadata ✅ (already fixed)
Webhook handlers derive `tier` from `extractPlanFromSubscription()` using the
Stripe price ID — not from client-set metadata. No code change needed.

### P2-7  `mapPriceToTier` silently defaults unknown price IDs to `free` ✅
`convex/lib/stripeOverlaySubscription.ts` — now throws on unknown price IDs
instead of silently downgrading. Monitor logs for unexpected throws after deploy
to catch any mis-configured price IDs.

### P2-8  Knowledge / memory content length uncapped ✅
- `convex/memories.ts` — `add` and `update` mutations reject content > 50 KB.
- `convex/knowledge.ts` — `reindexFileInternal` truncates content at 2 MB
  before chunking (doesn't reject the file, just caps what gets indexed).

### P2-9  Browser-task `task` string uncapped ✅
`src/app/api/app/browser-task/route.ts` — task is now stripped of control
characters and capped at 4096 characters before being passed to BrowserUse.

### P2-10  No bot protection on auth flows 🔲
**Requires your action in the WorkOS dashboard.**

Steps:
1. WorkOS Dashboard → Authentication → Bot Protection → Enable
2. Optionally add Cloudflare Turnstile on any custom sign-up/login pages

---

## P3 — Low / Hardening

### P3-3  Sentry `beforeSend` hook ✅
All Sentry entrypoints now use the shared sanitizer in
`src/lib/sentry-sanitize.ts`:
- `src/sentry.server.config.ts`
- `src/sentry.edge.config.ts`
- `src/instrumentation-client.ts`

Protections now enforced:
- Strip sensitive request headers: `Authorization`, `Cookie`, `Set-Cookie`,
  `Proxy-Authorization`, `X-API-Key`
- Replace `event.request.cookies` with `[REDACTED]`
- Redact secret-looking strings recursively across nested event payloads
  (`sk-*`, `pk_*`, `rk_*`, JWTs, long hex tokens)
- Redact sensitive query-string params in request URLs
  (`token`, `access_token`, `refresh_token`, `api_key`, `code`, etc.)

Verification:
- Focused regression test added at `src/lib/sentry-sanitize.test.ts`
- Ran:
  `node --test --experimental-strip-types src/lib/sentry-sanitize.test.ts`

### P3-7  localStorage audit ✅
Current writes audited — findings:
- `LandingThemeContext.tsx` — stores `'dark'`/`'light'` string ✅ safe
- `AppSettingsProvider.tsx` — stores UI settings JSON ✅ safe
- `AppSidebar.tsx` — stores sidebar collapse boolean ✅ safe
- `ChatInterface.tsx` — stores model IDs and selection modes ✅ safe
- `pricing/page.tsx` — was storing `userId` from URL query param in `localStorage` (persistent across sessions). **Fixed: moved to `sessionStorage`** (clears on tab close).

No access tokens, refresh tokens, or API keys found in any localStorage write. ✅

---

## Notes

- All code-side P0 and most P1 fixes are on branch `DevelopedByDev/security-audit`.
- Deploy that branch before telling users to expect the session logout (from P0-7 key rotation).
- After P0-7 env vars are set, do a rolling restart in Vercel to pick up new secrets.
