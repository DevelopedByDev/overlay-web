export const COMPUTER_TOOL_RPC_ALLOWLIST = [
  'search_knowledge',
  'composio.execute',
  'composio.search_tools',
] as const

export const COMPUTER_OPENCLAW_OVERLAY_TOOLS = [
  'overlay_list_notes',
  'overlay_get_note',
  'overlay_create_note',
  'overlay_update_note',
  'overlay_delete_note',
  'overlay_search_knowledge',
  'overlay_list_files',
  'overlay_get_file',
  'overlay_create_file',
  'overlay_update_file',
  'overlay_delete_file',
  'overlay_list_memories',
  'overlay_create_memory',
  'overlay_update_memory',
  'overlay_delete_memory',
  'overlay_create_output',
  'overlay_upload_output',
  'overlay_list_integrations',
  'overlay_execute_integration_tool',
] as const

export const COMPUTER_RESOURCE_CAPABILITIES = {
  sessions: ['list', 'create', 'update', 'delete', 'send', 'transcript'],
  workspaceFiles: ['list', 'read', 'write'],
  files: ['list', 'get', 'create', 'update', 'delete', 'upload'],
  notes: ['list', 'get', 'create', 'update', 'delete'],
  memories: ['list', 'create', 'update', 'delete'],
  skills: ['list', 'get'],
  integrations: ['list'],
  outputs: ['list', 'create', 'upload'],
  openclawOverlayPluginTools: [...COMPUTER_OPENCLAW_OVERLAY_TOOLS],
  tools: [...COMPUTER_TOOL_RPC_ALLOWLIST],
} as const

export type ComputerCapabilityGrant = typeof COMPUTER_RESOURCE_CAPABILITIES
