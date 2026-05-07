---
title: Convex Backend
topics: [stack, backend, data, operations]
files:
  - convex/schema.ts
  - convex/http.ts
  - convex/conversations.ts
  - convex/subscriptions.ts
  - convex/usage.ts
  - package.json
---

# Convex Backend

Convex is Overlay's persistent domain layer behind the Next.js API. The schema holds user UI settings, subscriptions, top-ups, webhook dedupe, rate limits, token usage, Daytona workspace records, tool invocation audit rows, and app data modules such as conversations, notes, memories, files, projects, outputs, skills, automations, and users.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `convex/schema.ts` - defines the core domain tables and indexes.
- `convex/http.ts` - hosts Convex HTTP routes, including the active Stripe webhook endpoint referenced by `docs/backend-overview.md`.
- `convex/conversations.ts` - stores conversation metadata and messages.
- `convex/subscriptions.ts` and `convex/usage.ts` - store billing state, entitlements, usage, and budget enforcement data.
- `package.json` - defines `convex:push:prod`, `convex:push:dev`, and `convex:push:all`.

## Configuration

Environment variables visible in `.env.example`: `NEXT_PUBLIC_CONVEX_URL`, `DEV_NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`, and `NEXT_PUBLIC_CONVEX_SITE_URL`.

## Future Capture

### Operational constraints

<!-- stub: capture deployment rules, migration order, and dev/prod deployment differences. -->

### Known gotchas

<!-- stub: capture Convex push, env, and webhook failure modes. -->
