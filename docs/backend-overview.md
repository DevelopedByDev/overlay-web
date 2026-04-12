# Overlay Backend Overview

This document is the backend handoff for any additional Overlay surface:

- web
- desktop
- mobile
- Chrome extension
- future internal agents/services

The goal is parity. New clients should reuse the same backend contracts and server flows that the web app already uses instead of re-implementing business logic locally.

## Core Principle

Overlay's backend source of truth is:

1. Next.js API routes in `src/app/api/**`
2. shared request/response contracts in `src/lib/app-contracts.ts`
3. shared server helpers in `src/lib/**`
4. Convex domain/state modules in `convex/**`

The web UI is not the source of truth. The API is.

For new surfaces, prefer:

- calling the same `src/app/api/**` routes the web app uses
- reusing the same auth model
- treating Convex as an internal persistence/domain layer behind the API

Avoid building separate client-specific logic for:

- auth/session interpretation
- model access
- billing checks
- Stripe integration
- usage metering
- memory/retrieval injection
- tool orchestration

## Recommended Architecture For New Surfaces

For desktop, mobile, and extension clients:

- use the Next API as the canonical backend
- use `GET /api/app/bootstrap` as the first signed-in sync call
- use `/api/app/*` routes for product data and actions
- use `/api/auth/*` routes for session/auth flows
- use billing routes under `/api/*` for Stripe-related actions

Do not make clients talk directly to model providers.

Do not make clients fetch provider keys.

Do not make clients reimplement `ask` or `act`.

## Authentication Model

### Browser/web auth

Browser auth is session-cookie based.

- session cookie name: `overlay_session`
- logic lives in `src/lib/workos-auth.ts`

Key routes:

- `GET /api/auth/session`
- `POST /api/auth/sign-in`
- `POST /api/auth/sign-up`
- `POST /api/auth/sign-out`
- `GET /api/auth/callback`
- `GET /api/auth/sso/[provider]`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/verify-email`
- `POST /api/auth/sync-profile`

### Native/mobile/desktop auth

Native clients can use bearer-token auth against the same backend.

Important routes:

- `POST /api/auth/native/refresh`
- `GET /api/auth/native/subscription`
- `POST /api/auth/desktop-link`

Important rule:

- `POST /api/auth/native/provider-keys` is intentionally disabled
- all provider/model access must stay server-mediated

### Shared auth resolver

Most app routes use `resolveAuthenticatedAppUser()` from `src/lib/app-api-auth.ts`.

That resolver accepts:

- browser session cookie
- bearer WorkOS access token
- internal service auth token

This is the main reason new clients should reuse existing routes instead of bypassing them.

### Internal service auth

Trusted first-party services can use:

- header: `x-overlay-service-auth`
- implementation: `src/lib/service-auth.ts`

This is for internal server-to-server calls only.

Do not ship this secret model to mobile/desktop/extension apps.

## Bootstrap Contract

### `GET /api/app/bootstrap`

This is the canonical signed-in app bootstrap route.

It returns:

- current user
- entitlements
- UI settings
- chat model catalog
- image model catalog
- video model catalog
- feature flags
- navigation destinations
- default model IDs

Implementation:

- `src/app/api/app/bootstrap/route.ts`
- types: `src/lib/app-contracts.ts`

Every new surface should start here after authentication.

This route is the best parity anchor for:

- mobile shell setup
- desktop shell setup
- extension popup/sidebar initialization

## Shared Contracts

The canonical DTO/type file is:

- `src/lib/app-contracts.ts`

Important shared shapes include:

- `AppBootstrapResponse`
- `Entitlements`
- `ConversationSummary`
- `ConversationMessage`
- `NoteDoc`
- `KnowledgeFile`
- `MemoryRow`
- `OutputSummary`
- `IntegrationSummary`
- `SkillSummary`
- `ProjectSummary`

If another client needs generated types, start from this file.

## Billing And Stripe

### Stripe model

Overlay uses Stripe for:

- subscriptions
- dynamic paid plan billing
- top-ups
- auto top-up preferences
- billing portal access

Current pricing model:

- paid plans are dynamic-price subscriptions
- `planAmountCents` is the effective monthly budget
- Stripe `quantity` is the pricing multiplier
- top-ups are one-time Stripe checkouts

### Public billing routes

- `GET /api/entitlements`
- `GET /api/subscription`
- `GET /api/app/subscription`
- `GET /api/subscription/settings`
- `POST /api/subscription/settings`
- `POST /api/checkout`
- `GET /api/checkout/verify`
- `POST /api/portal`
- `POST /api/topups/checkout`
- `GET /api/topups/verify`
- `GET /api/topups/history`

### Billing internals

Core logic lives in:

- `src/lib/billing-pricing.ts`
- `src/lib/billing-runtime.ts`
- `src/lib/stripe-billing.ts`
- `src/lib/stripe.ts`
- `convex/subscriptions.ts`
- `convex/usage.ts`
- `convex/stripe.ts`
- `convex/stripeSync.ts`
- `convex/lib/stripeOverlaySubscription.ts`

### Stripe webhook source of truth

The active Stripe webhook handler is not a Next route.

The live handler is:

- `convex/http.ts`

Webhook path:

- `/stripe/webhook` on the Convex deployment

The Next route `src/app/api/webhooks/stripe/route.ts` is deprecated and should not be used as the real webhook integration point.

### Billing expectations for new clients

New clients should:

- read entitlements from backend routes
- initiate checkout via backend routes
- initiate billing portal via backend routes
- never calculate paid entitlements locally
- never treat Stripe client state as the source of truth

## Conversations And AI

### Canonical conversation routes

- `GET /api/app/conversations`
- `POST /api/app/conversations`
- `PATCH /api/app/conversations`
- `DELETE /api/app/conversations`
- `POST /api/app/conversations/message`
- `DELETE /api/app/conversations/message`

These routes are the source of truth for:

- thread metadata
- model selections
- project linkage
- message persistence
- thread deletion

### Canonical AI execution routes

- `POST /api/app/conversations/ask`
- `POST /api/app/conversations/act`
- `POST /api/app/conversations/act/extension-plan`

These routes already handle:

- authentication
- free vs paid model gating
- budget enforcement
- auto top-up handling
- retrieval injection
- memory injection
- project instructions injection
- skill injection
- tool orchestration
- usage metering
- assistant-turn persistence

Any new client that wants parity with the web app should call these routes instead of rebuilding AI orchestration.

### Ask route purpose

`/api/app/conversations/ask` is the canonical “respond with tools and retrieval” route.

It is appropriate for:

- standard chat
- assistant Q&A
- knowledge-grounded answers
- streamed responses

### Act route purpose

`/api/app/conversations/act` is the canonical “agentic task execution” route.

It is appropriate for:

- browser tasks
- tool execution
- workflow assistance
- multi-step action flows

### Important AI helpers

Key logic lives in:

- `src/lib/openrouter-service.ts`
- `src/lib/ai-gateway.ts`
- `src/lib/models.ts`
- `src/lib/model-pricing.ts`
- `src/lib/ask-knowledge-context.ts`
- `src/lib/operator-system-prompt.ts`
- `src/lib/persist-assistant-turn.ts`
- `src/lib/sanitize-ui-messages-for-model.ts`

## Files, Notes, Memory, Projects, Outputs

These are all exposed as thin Next API wrappers over Convex.

### Notes

- route: `src/app/api/app/notes/route.ts`
- Convex module: `convex/notes.ts`

Supports:

- list
- get by ID
- create
- update
- delete
- project-scoped filtering
- incremental sync via `updatedSince`
- soft-delete aware sync via `includeDeleted`

### Memory

- route: `src/app/api/app/memory/route.ts`
- Convex module: `convex/memories.ts`

Supports:

- list
- get
- create
- update
- delete
- filtering by project/conversation/note
- chunking/segmentation on ingestion

### Files / knowledge files

- route: `src/app/api/app/files/route.ts`
- helpers:
  - `/api/app/files/presign`
  - `/api/app/files/upload-url`
  - `/api/app/files/ingest-document`
  - `/api/app/files/[fileId]/content`
- Convex module: `convex/files.ts`

Storage model:

- R2 is the durable object store
- Convex stores metadata and logical tree structure

### Projects

- route: `src/app/api/app/projects/route.ts`
- Convex module: `convex/projects.ts`

Supports:

- list
- get
- create
- update
- delete
- nested projects
- cascading subtree deletion
- incremental sync

### Outputs

- route: `src/app/api/app/outputs/route.ts`
- helper: `/api/app/outputs/[outputId]/content`
- Convex module: `convex/outputs.ts`

Outputs are generated artifacts such as:

- images
- video
- files produced by tools or sandboxes

### Settings

- route: `src/app/api/app/settings/route.ts`
- Convex module: `convex/uiSettings.ts`

Currently stores app-level user UI settings.

## Generation And Media

Routes:

- `POST /api/app/generate-image`
- `POST /api/app/generate-video`
- `POST /api/app/transcribe`
- `POST /api/app/generate-title`
- `POST /api/app/generate-tab-group-label`
- `GET /api/app/chat-suggestions`

These routes should stay server-mediated so that:

- model/provider selection remains consistent
- billing remains centralized
- usage metering remains correct

## Integrations, Skills, Automations

### Integrations

- route: `GET /api/app/integrations`
- Convex module: integration state is surfaced through Convex-backed flows plus Composio helpers

### Skills

- route: `GET /api/app/skills`
- Convex module: `convex/skills.ts`

### Automations

Routes:

- `GET/POST/PATCH/DELETE /api/app/automations`
- `POST /api/app/automations/run-now`
- `GET /api/app/automations/runs`
- `GET /api/app/automations/runs/detail`
- `POST /api/app/automations/runs/retry`

Internal executor route:

- `POST /api/internal/automations/execute`

Convex modules:

- `convex/automations.ts`
- `convex/automationRunner.ts`
- `convex/crons.ts`

Important rule:

- clients should manage automations through the public app routes
- only internal infrastructure should call the executor route

## Browser And Sandbox Execution

### Browser tasks

- route: `POST /api/app/browser-task`
- helper library: `browser-use-sdk`

This route already handles:

- auth
- paid-plan enforcement
- budget checks
- auto top-up fallback
- usage recording

### Daytona sandbox

- route: `POST /api/app/daytona/run`
- helpers in `src/lib/daytona.ts`

This route already handles:

- auth
- paid-plan enforcement
- budget checks
- workspace bootstrap
- artifact upload
- output recording

These are the routes other first-party clients should use if they need the same behaviors as the web app.

## Release / Update Routes

For desktop/native update checks:

- `GET /api/latest-release`
- `GET /api/latest-release/download`

These are the canonical app-update discovery endpoints.

## Convex As Internal Domain Layer

Convex is the persistent domain model behind the API.

Important modules:

- `convex/conversations.ts`
- `convex/notes.ts`
- `convex/memories.ts`
- `convex/files.ts`
- `convex/outputs.ts`
- `convex/projects.ts`
- `convex/skills.ts`
- `convex/automations.ts`
- `convex/subscriptions.ts`
- `convex/usage.ts`
- `convex/users.ts`
- `convex/uiSettings.ts`
- `convex/http.ts`
- `convex/stripeSync.ts`

For external clients, prefer not to bind directly to Convex functions unless you intentionally want a separate backend contract.

## Convex Proxy Route

There is a generic proxy route:

- `POST /api/convex/[type]`

Implementation:

- `src/app/api/convex/[type]/route.ts`

This proxies raw Convex query/mutation/action calls.

Recommendation:

- do not treat this as the primary public app API for mobile/desktop/extension work
- use the higher-level app routes instead

Reason:

- the higher-level routes encode business rules, auth rules, billing rules, and response normalization
- the raw Convex proxy is a transport utility, not the stable product contract

## Cross-Surface Integration Guidance

### Desktop

Desktop should use:

- native auth routes
- latest release routes
- `GET /api/app/bootstrap`
- the same `/api/app/*` resource routes
- `ask` and `act` for assistant behavior

### Mobile

Mobile should use:

- bearer-token auth
- `GET /api/app/bootstrap`
- the same `/api/app/*` routes as web
- backend-mediated billing routes

Avoid direct Stripe/mobile-only billing state logic.

### Chrome extension

Chrome should use:

- browser auth/session if embedded in the same origin, or bearer auth if needed
- `GET /api/app/bootstrap`
- `/api/app/conversations/*`
- `/api/app/notes`
- `/api/app/projects`
- `/api/app/files`
- `/api/app/settings`

If the extension needs AI behavior, it should call `ask`/`act`, not run its own parallel assistant orchestration.

## Source Of Truth Rules

If you are building another surface, follow these rules:

1. Use `GET /api/app/bootstrap` first.
2. Use `src/lib/app-contracts.ts` as the canonical shared DTO surface.
3. Use `/api/app/*` for product behavior.
4. Use `/api/auth/*` for auth/session flows.
5. Use `/api/checkout`, `/api/portal`, `/api/topups/*`, `/api/entitlements`, and `/api/subscription*` for billing.
6. Do not fetch provider keys on clients.
7. Do not bypass server-side billing checks.
8. Do not bypass `ask` and `act` if you want parity with the web app.
9. Treat Convex as an implementation layer, not the primary public contract.

## Best Next Step

If you want to generate client-specific agents from this document, the best follow-up documents would be:

- a route-by-route contract reference
- a mobile integration guide
- a desktop integration guide
- a Chrome extension integration guide
- a shared sync/offline strategy document

This file is the high-level backend map that those documents should build on.
