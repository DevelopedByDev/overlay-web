# Agent memory (continual learning)

## Learned User Preferences

- Prefer plain-language explanations for security, auth, and billing setup—not only code or env var names.
- When debugging integrations (Convex, WorkOS, Stripe), use concrete error logs or network responses early so fixes match the actual failure mode.
- For Convex changes that affect the running app, push to **both** deployments after editing `convex/`: run `npm run convex:push:all` (or `convex:push:prod` then `convex:push:dev`). Do **not** pass `.env.local` to `convex deploy` — that file usually sets `CONVEX_DEPLOYMENT` to the **dev** slug, which makes `deploy` hit the wrong API and return `MissingAccessToken`; use plain `convex deploy -y` / `npm run convex:push:prod` for production. Use `convex:push:dev` (`.env.development.local`) for the dev backend.
- For UI work, align new controls with the existing app chrome (header toggles, dropdowns, theme) rather than one-off styling.
- Run deploys, tests, and shell workflows in the environment when possible instead of only describing steps.

## Learned Workspace Facts

- This Next.js app selects Convex URL from env: development commonly uses `DEV_NEXT_PUBLIC_CONVEX_URL` for a separate dev backend from production `NEXT_PUBLIC_CONVEX_URL`.
- WorkOS access tokens are JWTs; Convex verifies them with JWKS and issuer/audience checks—`iss` is a claim inside the token, not a separate secret or cookie name.
- Session state for the web app uses an httpOnly cookie (`overlay_session`); the WorkOS access token lives inside that signed payload, not as a standalone visible JWT cookie name.
