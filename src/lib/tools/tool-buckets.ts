export type ToolCostBucket = 'perplexity' | 'image' | 'video' | 'browser' | 'composio' | 'internal'

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
])

/** Maps tool name → Convex toolInvocations.costBucket. */
export function toolCostBucketForId(toolId: string): ToolCostBucket {
  if (toolId === 'perplexity_search') return 'perplexity'
  if (toolId === 'generate_image') return 'image'
  if (toolId === 'generate_video') return 'video'
  if (toolId === 'browser_run_task') return 'browser'
  if (INTERNAL_TOOL_IDS.has(toolId)) return 'internal'
  return 'composio'
}

/** Avoid writing a row for every cheap internal read (knowledge and notes). */
export function shouldPersistToolInvocation(bucket: ToolCostBucket): boolean {
  return (
    bucket === 'perplexity' ||
    bucket === 'image' ||
    bucket === 'video' ||
    bucket === 'browser' ||
    bucket === 'composio'
  )
}
