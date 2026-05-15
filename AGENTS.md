# Agent memory (continual learning)

## Learned User Preferences

- Prefer plain-language explanations for security, auth, and billing setup—not only code or env var names.
- When debugging integrations (Convex, WorkOS, Stripe), use concrete error logs or network responses early so fixes match the actual failure mode.
- For Convex changes that affect the running app, push to **both** deployments after editing `convex/`: run `npm run convex:push:all` (or `convex:push:prod` then `convex:push:dev`). Do **not** pass `.env.local` to `convex deploy` — that file usually sets `CONVEX_DEPLOYMENT` to the **dev** slug, which makes `deploy` hit the wrong API and return `MissingAccessToken`; use plain `convex deploy -y` / `npm run convex:push:prod` for production. Use `convex:push:dev` (`.env.development.local`) for the dev backend.
- For local web work against the dev Convex backend, prefer `npm run dev:with-convex` so the dev deployment is pushed before `next dev` starts.
- For UI work, align new controls with the existing app chrome and design language. The user's aesthetic bar is very high — first-pass designs have been rejected repeatedly as "hideous"; default to the simplest, cleanest possible implementation and validate visually before considering it done.
- Run deploys, tests, and shell workflows in the environment when possible instead of only describing steps.
- For billing or Stripe webhook testing, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
- For verification, run the smallest check that covers the change. In this repo, targeted ESLint on changed files is acceptable when full `npm run lint` is blocked by unrelated generated or mobile issues.
- In model/item dropdowns, order by intelligence/quality (using `CHAT_MODEL_QUALITY_PRIORITY`) not by provider grouping.
- For capability icons in compact UI (e.g. model rows), render them as small badge chips (`inline-flex w-4 h-4 rounded bg-[#f0f0f0]`) with a thin-stroke lucide icon inside — not bare unstyled icons. Use `ScanEye` for vision and `Sparkles` for reasoning.
- Use Tailwind `group/row` + `group-hover/row:hidden` / `hidden group-hover/row:flex` to reveal secondary info (e.g. cost) on hover rather than always showing it.
- Streaming text must render in complete, markdown-formatted chunks without per-character diffs that cause visible flickering. Tool-call/action UIs should be minimal and collapsed by default.

## Learned Workspace Facts

- This Next.js app selects Convex URL from env: development commonly uses `DEV_NEXT_PUBLIC_CONVEX_URL` for a separate dev backend from production `NEXT_PUBLIC_CONVEX_URL`.
- WorkOS access tokens are JWTs; Convex verifies them with JWKS and issuer/audience checks—`iss` is a claim inside the token, not a separate secret or cookie name.
- Session state for the web app uses an httpOnly cookie (`overlay_session`); the WorkOS access token lives inside that signed payload, not as a standalone visible JWT cookie name.
- `src/lib/models.ts` `AVAILABLE_MODELS` carries a `cost: 0|1|2|3` field (0 = free, 1 = cheap, 2 = mid, 3 = expensive) and boolean `supportsVision` / `supportsReasoning` flags that must be kept accurate per model. The free router model has id `openrouter/free` and display name "Auto". `getModelsByIntelligence(isFreeTier)` returns models sorted by `CHAT_MODEL_QUALITY_PRIORITY` and hoists "Auto" to the top for free-tier users.
