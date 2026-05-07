---
title: Shared App Core
topics: [systems, data, clients, frontend]
files:
  - packages/overlay-app-core/package.json
  - packages/overlay-app-core/src/contracts.ts
  - packages/overlay-app-core/src/theme.ts
  - src/lib/app-contracts.ts
  - overlay-mobile/services/bootstrapService.ts
---

# Shared App Core

`@overlay/app-core` is the shared package for cross-client DTOs, app destinations, default settings, and theme tokens. The web app re-exports its API types through `src/lib/app-contracts.ts`, while the mobile client imports `AppBootstrap` directly and caches the bootstrap response from [[canonical-app-api]].

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `packages/overlay-app-core/src/contracts.ts` - defines `AppBootstrapResponse`, entitlements, conversations, notes, files, memories, outputs, integrations, skills, and canonical navigation destinations.
- `packages/overlay-app-core/src/theme.ts` - defines shared light and dark color tokens, spacing, radii, and font-size constants.
- `src/lib/app-contracts.ts` - exposes the shared contract types to the web backend.
- `overlay-mobile/services/bootstrapService.ts` - fetches and caches `/api/app/bootstrap` as `AppBootstrap`.

## Future Capture

### Compatibility rules

<!-- stub: capture rules for changing shared DTOs without breaking clients. -->
