---
title: Mobile Client
topics: [systems, clients, frontend, auth]
files:
  - overlay-mobile/package.json
  - overlay-mobile/.env.example
  - overlay-mobile/app/_layout.tsx
  - overlay-mobile/app/auth-flow.tsx
  - overlay-mobile/services/appApi.ts
  - overlay-mobile/services/bootstrapService.ts
  - overlay-mobile/services/authService.ts
---

# Mobile Client

`overlay-mobile` is an Expo Router app that uses bearer-token auth and the canonical app API for bootstrap, chat, knowledge, notes, projects, settings, integrations, automations, and voice services. It imports shared contracts from its local `@overlay/app-core` package and caches bootstrap state in AsyncStorage.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `overlay-mobile/package.json` - defines Expo SDK, Expo Router, native modules, and mobile check scripts.
- `overlay-mobile/services/appApi.ts` - attaches bearer auth, user IDs, JSON bodies, request timeouts, and SSE parsing for app API calls.
- `overlay-mobile/services/bootstrapService.ts` - fetches and caches `/api/app/bootstrap`.
- `overlay-mobile/services/authService.ts` - manages mobile auth session state.
- `overlay-mobile/app/auth-flow.tsx` - implements the mobile auth flow.
- `overlay-mobile/app/_layout.tsx` - configures the Expo Router app layout.

## Configuration

`overlay-mobile/.env.example` exists separately from the root `.env.example`; capture exact mobile env keys here when they matter to a change.

## Future Capture

### Compatibility rules

<!-- stub: capture mobile-web parity expectations and direct-backend restrictions. -->

### Known gotchas

<!-- stub: capture auth redirect, secure storage, SSE, and Expo dev-client issues. -->
