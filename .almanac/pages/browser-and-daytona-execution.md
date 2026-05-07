---
title: Browser and Daytona Execution
topics: [stack, systems, execution, backend, ai]
files:
  - src/app/api/app/browser-task/route.ts
  - src/app/api/app/daytona/run/route.ts
  - src/lib/daytona.ts
  - src/lib/daytona-pricing.ts
  - convex/daytona.ts
  - convex/daytonaReconcile.ts
  - scripts/daytona-tool-smoke.ts
---

# Browser and Daytona Execution

Overlay server-mediates execution work that can incur cost or run outside the chat model. Browser tasks use the `browser-use-sdk`, while Daytona provides persistent code execution workspaces with Convex records for workspace state and usage ledger entries.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `src/app/api/app/browser-task/route.ts` - exposes authenticated browser tasks with paid-plan and budget enforcement.
- `src/app/api/app/daytona/run/route.ts` - runs Daytona tasks through the canonical app API.
- `src/lib/daytona.ts` - creates and syncs Daytona workspaces, sandboxes, volumes, paths, and resource profiles.
- `src/lib/daytona-pricing.ts` - maps Daytona resource profiles and usage costs.
- `convex/daytona.ts` and `convex/daytonaReconcile.ts` - persist and reconcile workspace state.
- `scripts/daytona-tool-smoke.ts` - smoke-tests Daytona tool execution.

## Configuration

Environment variables visible in `.env.example`: `BROWSER_USE_API_KEY`, `DAYTONA_API_KEY`, and `DAYTONA_API_URL`.

## Future Capture

### Operational constraints

<!-- stub: capture workspace lifecycle, metering, reconciliation, and artifact upload behavior. -->

### Known gotchas

<!-- stub: capture browser task failures and Daytona API quirks. -->
