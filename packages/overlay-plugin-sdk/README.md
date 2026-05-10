# @overlay/plugin-sdk

SDK for building Overlay plugins — tools, UI panels, auth providers, and themes.

## Usage

```ts
import { defineTool } from '@overlay/plugin-sdk/server'

export default defineTool({
  id: 'acme.lookupEmployee',
  name: 'Lookup Employee',
  description: 'Find an employee by email',
  parameters: z.object({ email: z.string() }),
  async execute(args, context) {
    // ...
  },
})
```

## Capabilities

- `tool` — Register new AI-callable tools
- `ui-panel` — Add sidebar tabs or pages
- `auth-provider` — Custom authentication (SAML, OIDC, LDAP)
- `storage-provider` — Swap file storage backend
- `db-provider` — Swap database backend
- `ai-provider` — Custom AI inference
- `theme` — White-label theming
- `webhook` — Register HTTP handlers

## Manifest

Every plugin ships an `overlay-plugin.json`:

```json
{
  "id": "acme.corp.tools",
  "name": "Acme Tools",
  "version": "1.0.0",
  "capabilities": ["tool"],
  "entrypoints": { "server": "./dist/server.js" }
}
```
