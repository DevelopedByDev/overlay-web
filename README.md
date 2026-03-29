# Overlay Web App

Overlay is a Next.js + Convex application that combines a public marketing site with a
signed-in AI workspace. The product is centered around chat, notes, memories, knowledge,
projects, and media generation.

This repository contains the web surface for Overlay:

- The landing site and pricing/legal pages.
- The authenticated `/app/*` product experience.
- Next.js API routes for auth, Stripe, file/media flows, and AI interactions.
- The Convex backend schema and functions that power app data, usage tracking, and
  server-side integrations.

## What You Can Do In Overlay

- Chat with multiple model providers.
- Save and retrieve notes, memories, files, and project context.
- Run "Ask" and "Act" flows with tool calling.
- Generate images and videos.
- Connect external tools through Composio.
- Manage subscriptions and entitlements with Stripe.

## Tech Stack

- `Next.js 15` with the App Router.
- `Convex` for backend functions, data, and realtime state.
- `WorkOS` for authentication.
- `Stripe` for billing and subscription events.
- `Vercel AI SDK` plus provider SDKs for OpenAI, Anthropic, Google, Groq, xAI, and OpenRouter.
- `TipTap`, `react-markdown`, and KaTeX for rich editing and rendering.

## Repository Layout

```text
.
├── convex/                  # Backend schema, queries, mutations, actions, HTTP routes
├── src/app/                 # Next.js pages, layouts, and API route handlers
├── src/components/          # Marketing and app UI components
├── src/lib/                 # Shared auth, model, tools, Stripe, and helper code
├── scripts/                 # Sanity scripts and one-off checks
├── docs/                    # Product and implementation docs
├── ENV_SETUP.md             # Environment setup guide
├── SECURITY.md              # Security policy and reporting guidance
└── TESTING_CHECKLIST.md     # Manual Stripe/subscription test notes
```

## Important Product Areas

### Public site

- `/` is the animated landing page.
- `/pricing`, `/manifesto`, `/privacy`, and `/terms` are public content pages.

### Authenticated app

- `/app/chat`
- `/app/notes`
- `/app/memories`
- `/app/knowledge`
- `/app/projects`
- `/app/outputs`
- `/app/integrations`
- `/app/voice`

### Key API surfaces

- `src/app/api/auth/*` for sign-in, SSO, callback, session, desktop/mobile handoff, and refresh.
- `src/app/api/app/conversations/*` for Ask/Act chat flows.
- `src/app/api/app/files/*`, `memory`, `notes`, `projects`, `skills`, and `outputs`.
- `src/app/api/webhooks/stripe/route.ts` for Stripe webhooks.

## Local Development

### Prerequisites

- Node.js 20+
- npm
- A Convex account and separate dev/prod deployments
- WorkOS app credentials if you want auth enabled
- Stripe test credentials if you want billing flows enabled

### Install

```bash
npm install
```

### Configure environment variables

1. Copy `.env.example` to the env files you need.
2. Fill in the placeholders with your own deployment URLs and secrets.
3. Read `ENV_SETUP.md` for the full setup matrix across web, Convex, mobile, and desktop.

### Run the app

```bash
npm run dev
```

### Build locally

```bash
npm run build
npm run start
```

## Convex Workflow

This repo expects separate Convex environments for development and production.

```bash
npm run convex:push:prod
npm run convex:push:dev
npm run convex:push:all
```

If you change anything inside `convex/`, push both deployments so the web app and backend
stay aligned.

## Available Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run test:unified-tools` | Run the unified tools sanity script |
| `npm run convex:push:prod` | Push Convex changes to production |
| `npm run convex:push:dev` | Push Convex changes to dev |
| `npm run convex:push:all` | Push Convex changes to both deployments |

## Ask / Act Tooling

Overlay merges several tool layers into chat:

- Overlay-native tools from `src/lib/tools/build.ts`
- Composio tool integrations from `src/lib/composio-tools.ts`
- AI Gateway / Perplexity search when enabled

Primary orchestration happens in:

- `src/app/api/app/conversations/ask/route.ts`
- `src/app/api/app/conversations/act/route.ts`

Successful and failed tool calls can also be recorded into Convex usage/audit tables.

## Models And Generation

Model catalogs live in `src/lib/models.ts` and include:

- Text chat models
- Image generation models
- Video generation models

The app supports capability-aware model metadata such as:

- reasoning
- vision
- search
- cost tier

## Integrations

Overlay currently includes integration surfaces for:

- WorkOS auth
- Stripe billing
- Composio-connected tools
- OpenRouter
- Vercel AI Gateway

## Security Notes

- Public docs use placeholders instead of live deployment identifiers.
- Local Cursor state files are ignored and should not be committed.
- Session cookies are encrypted and signed before storage.
- Transfer tokens are short-lived, encrypted before storage, hashed for lookup, and can be bound to a client-provided verifier.
- Provider key export is isolated behind a dedicated `PROVIDER_KEYS_SECRET`; the Next.js server reads provider env vars directly.
- Client-supplied `systemPrompt` values are treated as lower-priority extensions and cannot override operator instructions.
- Sensitive logs are redacted in higher-risk chat and billing flows.
- See `SECURITY.md` for reporting guidance and secure contribution expectations.

## CI / Repository Safeguards

GitHub Actions includes a security workflow that:

- runs `gitleaks` for secret scanning
- blocks `NEXT_PUBLIC_*` variables that look like secret-bearing env names

## Open Source Expectations

If you plan to contribute:

- do not commit real secrets, tokens, or customer data
- keep public docs on placeholders
- treat `NEXT_PUBLIC_*` values as public
- prefer adding new backend logic in `convex/` and corresponding web handlers in `src/app/api/`

## Related Docs

- `ENV_SETUP.md`
- `SECURITY.md`
- `TESTING_CHECKLIST.md`

## Status

This repository is actively evolving. Expect product-specific architecture, auth, billing,
and tool integrations to change as the system is hardened and prepared for broader
open-source collaboration.
