---
title: Composio and MCP Integrations
topics: [stack, systems, integrations, backend, ai]
files:
  - src/lib/composio-tools.ts
  - src/lib/mcp-tools.ts
  - src/lib/mcp-schema-to-zod.ts
  - src/app/api/app/integrations/route.ts
  - src/app/api/app/mcps/route.ts
  - convex/mcpServers.ts
---

# Composio and MCP Integrations

Overlay exposes connected app tools through Composio and user-configured MCP servers. The act route can merge Composio tools, web tools, MCP tools, and Overlay internal tools, with filtering based on tier and tool exposure policy.

<!-- stub: the writer will fill this in over sessions -->

## Where we use it

- `src/lib/composio-tools.ts` - loads Composio packages, creates user sessions, normalizes session IDs, removes disabled Composio tools, and caches toolsets.
- `src/lib/mcp-tools.ts` - builds MCP toolsets for model execution.
- `src/lib/mcp-schema-to-zod.ts` - adapts MCP schemas for tool validation.
- `src/app/api/app/integrations/route.ts` - lists integration state for clients.
- `src/app/api/app/mcps/route.ts` - manages MCP server records through the app API.
- `convex/mcpServers.ts` - persists MCP server configuration.

## Configuration

Environment variables visible in `.env.example`: `COMPOSIO_API_KEY`.

## Future Capture

### Known gotchas

<!-- stub: capture Composio session behavior, MCP schema conversion issues, and tool filtering rules. -->
