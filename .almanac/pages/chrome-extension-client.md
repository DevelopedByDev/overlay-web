---
title: Chrome Extension Client
topics: [systems, clients, frontend, execution]
files:
  - overlay-chrome/package.json
  - overlay-chrome/src/background/index.ts
  - overlay-chrome/src/background/overlay-api.ts
  - overlay-chrome/src/content/bridge.ts
  - overlay-chrome/src/sidepanel/App.tsx
  - overlay-chrome/packages/overlay-extension-contracts/src/index.ts
  - overlay-chrome/packages/overlay-chat-ui/src/index.ts
---

# Chrome Extension Client

`overlay-chrome` is a Vite-built Chrome extension with background scripts, content bridge code, a side panel UI, shared extension contracts, and a synced chat UI package. It calls the same app API as other clients and augments questions with browser page and tab context.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `overlay-chrome/package.json` - defines extension build, test, typecheck, and chat UI sync scripts.
- `overlay-chrome/src/background/overlay-api.ts` - refreshes sessions, builds bearer headers, finds host tabs, and builds browser context prompts.
- `overlay-chrome/src/background/index.ts` - runs the extension background entry point.
- `overlay-chrome/src/content/bridge.ts` - connects host page context to extension messaging.
- `overlay-chrome/src/sidepanel/App.tsx` - renders the side panel app.
- `overlay-chrome/packages/overlay-extension-contracts/src/index.ts` - defines extension-side shared types and contracts.
- `overlay-chrome/packages/overlay-chat-ui/src/index.ts` - exports the shared chat UI package.

## Future Capture

### Invariants

<!-- stub: capture extension storage, host-tab communication, context scoping, and sync-package rules. -->

### Known gotchas

<!-- stub: capture Chrome messaging, stale host-tab, and chat UI sync failures. -->
