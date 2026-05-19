# Modular UI Migration Notes

Feature screens now live under `src/features/<domain>/components/` (Phase 1.1). They remain the web containers for routing, auth, uploads, browser APIs, billing, and local persistence. Shared primitives stay in `src/components/{ui,layout,providers}/`. Canonical shared APIs live in packages.

## Phase 1.2 — `src/lib/` split

`src/lib/` is removed. Imports use:

| Area | Path | Role |
| --- | --- | --- |
| Server-only domain code | `src/server/{auth,billing,storage,database,ai,agent,chat,tools,observability}/` | Node/WorkOS/Stripe/R2/Convex HTTP, agents, chat persistence |
| Isomorphic shared code | `src/shared/{chat,markdown,security,web,storage,knowledge,app,tools,auth,database,billing,ai}/` | Client-safe modules only; must not import `@/server/*` |
| Feature-local helpers | `src/features/<domain>/lib/` | Landing, integrations, auth cookie, share URLs, notebook blocks, automations drafts, file export |

Convex functions that imported `../src/lib/*` now import the matching `../src/server/*` or `../src/shared/*` paths.

Scripts: `scripts/phase-1.2-restructure-lib.sh`, `scripts/phase-1.2-update-imports.mjs`.

## Phase 1.3 — `server-only` boundaries

Every file under `src/server/**/*.ts` starts with `import 'server-only'`. Importing `@/server/*` from a Client Component should fail at build time.

**Moved to `src/shared/` (client-safe):**

- `billing/billing-pricing.ts`
- `ai/gateway/{model-types,model-data,model-fallbacks,generated/}`
- `chat/{chat-title,chat-model-prefs,chat-list-cache,chat-suggestions-defaults,cloudflare-chat-transport}`
- `auth/session-types.ts` (`AuthUser`, `AuthSession` for UI)
- `knowledge/ask-knowledge-types.ts` (citation types for chat UI)

**Moved to `src/server/` (were incorrectly under shared):**

- `knowledge/{mention-resolver,ask-knowledge-context}`
- `security/rate-limit.ts`
- `web/web-tools.ts`
- `chat/context-compaction.ts`

Scripts: `scripts/phase-1.3-restructure-server-shared.sh`, `scripts/phase-1.3-update-imports.mjs`, `scripts/phase-1.3-add-server-only.mjs`.

## Canonical Packages

- `@overlay/app-core`: app shell registries, contracts, and pure module controllers.
- `@overlay/api-client`: typed transport for `/api/app/*`.
- `@overlay/ui`: UI primitives and shared styling.
- `@overlay/chat-core`: shared chat behavior.
- `@overlay/chat-react`: React DOM chat components.
- `@overlay/modules-react`: React DOM components for files/knowledge, notes, projects, extensions, and settings.

## Replacement Path

| Compatibility wrapper | Canonical direction |
| --- | --- |
| `src/features/knowledge/components/KnowledgeView.tsx` | Contracts and controllers in `@overlay/app-core`, transport in `@overlay/api-client`, presentation in `@overlay/modules-react/knowledge`. |
| (OutputsView — not yet in tree) | Use output contracts, output API methods, and `OutputGallery`. |
| `src/features/knowledge/components/MemoriesView.tsx` | Use memory contracts, memory API methods, and memory controller helpers. |
| `src/features/notebook/components/NotebookEditor.tsx` | Notes are canonical `kind: note` files; use notes API aliases and `NotesEditorShell`. |
| `src/features/projects/components/ProjectsView.tsx` and `ProjectsSidebar.tsx` | Use project contracts, project API methods, `buildProjectTree`, `ProjectTree`, and `ProjectDetail`. |
| `src/features/tools/components/ToolsView.tsx`, `src/features/integrations/components/*`, `src/features/automations/components/SkillsView.tsx` | Use extension contracts, typed API methods, `filterExtensionCatalog`, `ExtensionCatalog`, and `McpServerForm`. |
| `src/app/app/settings/page.tsx` | Use settings registries, settings/account API methods, and `SettingsSectionRenderer`. |
| `src/app/account/page.tsx` | Keep billing/account orchestration in web; share typed billing contracts through `@overlay/app-core` and transport through `@overlay/api-client`. |

## Migration Rule

Move one feature slice at a time. Keep URL behavior, local storage keys, rendering behavior, and endpoint behavior unchanged while replacing direct local fetches with `overlayAppClient` and moving reusable state into `@overlay/app-core/modules`.
