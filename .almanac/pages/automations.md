---
title: Automations
topics: [systems, flows, automations, backend, ai]
files:
  - src/app/api/app/automations/route.ts
  - src/app/api/app/automations/run/route.ts
  - src/app/api/app/automations/test/route.ts
  - convex/automations.ts
  - convex/automationRunner.ts
  - convex/crons.ts
---

# Automations

Overlay has a first-party automation system for scheduled or user-triggered AI workflows. Public app routes manage automation definitions and runs, while Convex modules store automation state, run history, and cron behavior.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `src/app/api/app/automations/route.ts` - exposes automation CRUD through the app API.
- `src/app/api/app/automations/run/route.ts` - triggers automation execution.
- `src/app/api/app/automations/test/route.ts` - supports automation test flows.
- `convex/automations.ts` - stores automation definitions and run data.
- `convex/automationRunner.ts` - contains runner behavior.
- `convex/crons.ts` - wires scheduled execution.

## Future Capture

### Invariants

<!-- stub: capture trigger semantics, approval behavior, retry rules, and transcript persistence. -->

### Known gotchas

<!-- stub: capture cron, internal executor, and run-state failure modes. -->
