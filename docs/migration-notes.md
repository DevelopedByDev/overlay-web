# Modular UI Migration Notes

Feature screens now live under `src/features/<domain>/components/` (Phase 1.1). They remain the web containers for routing, auth, uploads, browser APIs, billing, and local persistence. Shared primitives stay in `src/components/{ui,layout,providers}/`. Canonical shared APIs live in packages.

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
