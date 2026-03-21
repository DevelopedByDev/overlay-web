## Cursor Cloud specific instructions

### Overview

This is the **Overlay landing page** (`getoverlay-landing`) — a Next.js 15 marketing/product website for the Overlay macOS desktop app. It is hosted at `getoverlay.io`.

### Tech Stack

- **Framework:** Next.js 15, React 18, TypeScript
- **Styling:** Tailwind CSS 4, Framer Motion (scroll-driven animations)
- **Backend:** Convex (cloud-hosted serverless DB + functions)
- **Auth:** WorkOS (email/password, OAuth, SSO)
- **Payments:** Stripe (subscriptions)

### Running Locally

- **Dev server:** `npm run dev` (port 3000)
- **Lint:** `npm run lint`
- **Build:** `npm run build`
- The dev server requires `NEXT_PUBLIC_CONVEX_URL` to be set for Convex-dependent API routes, but the main landing page and static pages render without it (a console warning is logged).
- Auth pages (`/auth/*`) and account page (`/account`) require WorkOS credentials (`WORKOS_API_KEY`, `WORKOS_CLIENT_ID`) configured in the backend.
- Stripe features (`/api/checkout`, `/api/webhooks/stripe`) require `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- See `ENV_SETUP.md` for the full list of environment variables.

### Key Gotchas

- The homepage (`/`) is entirely client-rendered with scroll-based animations (Framer Motion). It has a `1200vh` scroll spacer, so be aware when testing scroll behavior.
- Convex auto-generated files in `convex/_generated/` produce ESLint warnings (unused eslint-disable directives); these are safe to ignore.
- No automated test suite exists in this repository. Testing is manual.
- The `middleware.ts` file handles auth session checks — it reads cookies and may redirect unauthenticated users on protected routes (`/account`).
