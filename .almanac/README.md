# Overlay Almanac

This codealmanac wiki captures repo knowledge that future agents would
otherwise have to rediscover: cross-client contracts, backend invariants,
integration gotchas, UI constraints, and operational rules that are not obvious
from one file.

The primary reader is an AI coding agent working in this repo. The secondary
reader is a human scanning for the shape of Overlay.

## Notability Bar

Create or expand a page when the knowledge is durable and non-obvious:

- a flow spans web API routes, Convex modules, and client surfaces
- a service has environment-specific behavior or deployment constraints
- a design rule affects multiple UI surfaces
- a billing, auth, storage, or model-routing invariant would be risky to miss
- a failure, migration, or workaround was discovered through debugging
- a first-party client depends on a shared API contract

Do not create pages for one-off utility files, dev tooling, package plumbing,
or generic documentation for dependencies. Prefer a focused page about how
Overlay uses a service over a broad page about the service itself.

## Topic Taxonomy

Topics form a small DAG. Add depth only when pages need it.

- `stack` - third-party frameworks, runtimes, and external services
- `systems` - custom Overlay systems and domain modules
- `flows` - cross-file, end-to-end processes
- `frontend` - web UI, app shell, and rendered client behavior
- `backend` - Next API routes, Convex modules, server-only helpers
- `clients` - first-party desktop, mobile, and extension clients
- `auth` - WorkOS, session cookies, bearer tokens, service auth
- `billing` - Stripe, plans, usage, budgets, top-ups, entitlements
- `ai` - model catalog, routing, streaming, tools, media generation
- `data` - Convex records, shared DTOs, knowledge, memory, persistence
- `storage` - durable object storage, upload/download URLs, quotas
- `integrations` - Composio, MCP servers, connected app tooling
- `execution` - browser tasks, Daytona sandboxes, local/native agents
- `automations` - scheduled or user-triggered AI workflows
- `design` - visual language, shared theme tokens, component constraints
- `operations` - deploy, release, monitoring, env, and runtime constraints

Suggested parent relationships:

- `auth`, `billing`, `ai`, `data`, `storage`, `integrations`, `execution`,
  `automations`, and `operations` sit under `backend` when they describe server
  behavior.
- `design` sits under `frontend`.
- `desktop`, `mobile`, and `extension` can be introduced under `clients` once
  enough pages use them.

Only create a topic in the DAG when at least one page uses it.

## Anchor Categories

Prefer pages for these anchors:

- **Entity** - a stable service, runtime, package, client, or subsystem
- **Flow** - a multi-file process such as auth, checkout, sync, or execution
- **Decision** - a known reason for choosing one approach over another
- **Gotcha** - a specific failure mode, workaround, or operational rule

These categories are prompts, not a schema. A page is useful when it gives a
future agent a place to attach knowledge learned in later sessions.

## Writing Conventions

- Write observable facts from this repo. If the reason is not visible, add a
  future-capture heading instead of inventing rationale.
- Reference real paths in `files:` and in prose. Keep file references specific.
- Use env var names exactly as they appear in `.env.example`.
- For Convex changes, capture whether production and dev deployments both need
  pushes. This repo commonly uses `npm run convex:push:all`.
- For auth and billing, explain the security model in plain language as well as
  naming the functions and env vars.
- Use page wikilinks only for pages that exist in `.almanac/pages/`.
- Use file wikilinks only after verifying the path exists.
- Keep stubs short. Future sessions should add gotchas, incidents, decisions,
  and invariants when real work uncovers them.

## Page Format

Each page should have frontmatter:

```yaml
---
title: Page title
topics: [systems, backend]
files:
  - src/path.ts
---
```

Then include a one-paragraph repo-specific summary, a stub marker, and a
`Where we use it` section. Add empty future-capture sections only where they
are likely to hold useful knowledge.
