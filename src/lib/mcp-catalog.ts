export type MCPCatalogTransport = 'sse' | 'streamable-http'
export type MCPCatalogAuthType = 'none' | 'bearer' | 'header'

export interface MCPCatalogEntry {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly transport: MCPCatalogTransport
  readonly urlTemplate: string
  readonly defaultAuthType: MCPCatalogAuthType
  readonly authPlaceholder: string
  readonly docsUrl: string
  readonly category: string
}

export const MCP_CATALOG: readonly MCPCatalogEntry[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repository, issue, pull request, and code search tools for GitHub.',
    transport: 'streamable-http',
    urlTemplate: 'https://api.githubcopilot.com/mcp/',
    defaultAuthType: 'bearer',
    authPlaceholder: 'GitHub personal access token',
    docsUrl: 'https://github.com/github/github-mcp-server',
    category: 'Code',
  },
  {
    id: 'cloudflare-workers-bindings',
    name: 'Cloudflare Workers Bindings',
    description: 'Inspect and manage Cloudflare Workers bindings from an MCP client.',
    transport: 'streamable-http',
    urlTemplate: 'https://bindings.mcp.cloudflare.com/sse',
    defaultAuthType: 'bearer',
    authPlaceholder: 'Cloudflare API token',
    docsUrl: 'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers/',
    category: 'Cloudflare',
  },
  {
    id: 'cloudflare-observability',
    name: 'Cloudflare Observability',
    description: 'Query Cloudflare observability data and operational context.',
    transport: 'streamable-http',
    urlTemplate: 'https://observability.mcp.cloudflare.com/sse',
    defaultAuthType: 'bearer',
    authPlaceholder: 'Cloudflare API token',
    docsUrl: 'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers/',
    category: 'Cloudflare',
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Investigate errors, issues, traces, and project health from Sentry.',
    transport: 'streamable-http',
    urlTemplate: 'https://mcp.sentry.dev/sse',
    defaultAuthType: 'bearer',
    authPlaceholder: 'Sentry auth token',
    docsUrl: 'https://docs.sentry.io/mcp/',
    category: 'Observability',
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Search issues, projects, teams, and workspace planning context.',
    transport: 'streamable-http',
    urlTemplate: 'https://mcp.linear.app/sse',
    defaultAuthType: 'bearer',
    authPlaceholder: 'Linear API key',
    docsUrl: 'https://linear.app/docs',
    category: 'Product',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Connect pages, databases, and workspace content from Notion.',
    transport: 'streamable-http',
    urlTemplate: 'https://mcp.notion.com/sse',
    defaultAuthType: 'bearer',
    authPlaceholder: 'Notion integration token',
    docsUrl: 'https://developers.notion.com/docs/mcp',
    category: 'Knowledge',
  },
  {
    id: 'composio-template',
    name: 'Composio template',
    description: 'Template endpoint for Composio-hosted MCP toolkits.',
    transport: 'streamable-http',
    urlTemplate: 'https://mcp.composio.dev/{toolkit_slug}/{api_key}',
    defaultAuthType: 'none',
    authPlaceholder: 'API key is included in the URL path',
    docsUrl: 'https://mcp.composio.dev',
    category: 'Integrations',
  },
] as const
