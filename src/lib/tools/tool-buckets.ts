export type ToolCostBucket = 'perplexity' | 'image' | 'video' | 'composio' | 'internal'

const INTERNAL_TOOL_IDS = new Set<string>([
  'search_knowledge',
  'save_memory',
  'update_memory',
  'delete_memory',
  'list_notes',
  'get_note',
  'create_note',
  'update_note',
  'delete_note',
  'list_computer_sessions',
  'get_computer_session_messages',
  'list_computer_workspace_files',
  'read_computer_workspace_file',
  'create_computer_session',
  'update_computer_session',
  'delete_computer_session',
  'write_computer_workspace_file',
  'run_computer_gateway_command',
])

/** Maps tool name → Convex toolInvocations.costBucket. */
export function toolCostBucketForId(toolId: string): ToolCostBucket {
  if (toolId === 'perplexity_search') return 'perplexity'
  if (toolId === 'generate_image') return 'image'
  if (toolId === 'generate_video') return 'video'
  if (INTERNAL_TOOL_IDS.has(toolId)) return 'internal'
  return 'composio'
}

/** Avoid writing a row for every cheap internal read (knowledge, notes, computer listings). */
export function shouldPersistToolInvocation(bucket: ToolCostBucket): boolean {
  return bucket === 'perplexity' || bucket === 'image' || bucket === 'video' || bucket === 'composio'
}
