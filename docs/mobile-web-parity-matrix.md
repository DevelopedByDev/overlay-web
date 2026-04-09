# Mobile/Web Parity Matrix

Canonical source: `overlay-landing/src/app/app/*`, `AppSidebar`, `ChatInterface`, `NotebookEditor`.

| Surface | Canonical Web Route | Mobile Route | Auth | Query/Subviews | Core Actions | States/Gates |
| --- | --- | --- | --- | --- | --- | --- |
| Chat | `/app/chat` | `/(tabs)/chat`, `/chat/[id]` | Required | `projectId`, reply context | Create, stream, ask/act, attach, delete, reply | Empty, loading, streaming, error, premium gating |
| Notes | `/app/notes` | `/(tabs)/notes`, `/note/[id]` | Required | `projectId` | Create, autosave, delete, edit | Empty, loading, error |
| Knowledge | `/app/knowledge` | `/(tabs)/knowledge` | Required | `view=memories\|files\|outputs` | Memory CRUD, file tree CRUD, output browse | Loading, empty, storage limits |
| Extensions | `/app/tools` | `/more/extensions` | Required | `view=connectors\|skills\|mcps\|apps\|all` | Connect/disconnect integrations, skill CRUD | Loading, empty, placeholder subviews |
| Projects | `/app/projects` | `/(tabs)/projects` | Required | `view=chat\|note\|file`, `id`, `projectName` | Select project, open project chat/note/file | Empty, loading |
| Automations | `/app/automations` | `/more/automations` | Required | detail + run views | Create, edit, run now, retry, inspect run | Loading, empty, readiness/error |
| Settings | `/app/settings` | `/more/settings` | Required | `section=general\|account\|customization\|models\|contact` | Theme, account access, model guidance | Loading, saving |
| Account | `/account` | `/more/account` | Required | none | Manage billing/account | Auth/entitlement gated |
| Outputs redirect | `/app/outputs` | Knowledge outputs subview | Required | redirects to `knowledge?view=outputs` | Browse/download/delete outputs | Loading, empty |
| Voice redirect | `/app/voice` | Chat composer voice tools | Required | redirect to `/app/chat` | Voice input/transcription | Permission denied, transcription error |
| App root | `/app` | app entry -> chat | Required | redirect to `/app/chat` | App bootstrap | Auth redirect |
