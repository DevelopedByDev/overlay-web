---
title: Desktop Client
topics: [systems, clients, frontend, execution]
files:
  - overlay-desktop/README.md
  - overlay-desktop/package.json
  - overlay-desktop/src/main/index.ts
  - overlay-desktop/src/preload/index.ts
  - overlay-desktop/src/renderer/src/services/desktop-api-client.ts
  - overlay-desktop/src/main/services/agent/agent-service.ts
---

# Desktop Client

`overlay-desktop` is an Electron app with React renderer surfaces, main-process services, local transcription, local memory, browser automation, and native OS integration. It can call Overlay web API routes through bearer-token auth and has its own main/preload/renderer separation.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `overlay-desktop/README.md` - documents the desktop product, architecture, local transcription, browser panel, agents, memory, and security model.
- `overlay-desktop/package.json` - defines Electron, React, Vite, build scripts, local STT bundle scripts, and Node `>=22.0.0`.
- `overlay-desktop/src/main/index.ts` - starts the Electron main process.
- `overlay-desktop/src/preload/index.ts` - bridges renderer and main-process APIs.
- `overlay-desktop/src/renderer/src/services/desktop-api-client.ts` - calls the web app API with bearer auth and refresh behavior.
- `overlay-desktop/src/main/services/agent/agent-service.ts` - participates in the desktop agent system.

## Future Capture

### Operational constraints

<!-- stub: capture signing, notarization, release, local model bundle, and OS permission rules. -->

### Known gotchas

<!-- stub: capture IPC, auth, update, and native permission failures. -->
