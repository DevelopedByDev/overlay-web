import type { ToolMode } from './types'

/** Max model tool rounds (steps) for Ask mode (streamText / agent). */
export const MAX_TOOL_STEPS_ASK = 10

/** Max model tool rounds for Act mode — act/route.ts ToolLoopAgent uses this. */
export const MAX_TOOL_STEPS_ACT = 12

const OVERLAY_TOOL_IDS_ASK = new Set<string>(['search_knowledge'])

const OVERLAY_TOOL_IDS_ACT = new Set<string>([
  'search_knowledge',
  'save_memory',
  'update_memory',
  'delete_memory',
  'generate_image',
  'generate_video',
])

export function overlayToolIdsForMode(mode: ToolMode): ReadonlySet<string> {
  return mode === 'ask' ? OVERLAY_TOOL_IDS_ASK : OVERLAY_TOOL_IDS_ACT
}

/** Defense in depth: ensure a tool id is registered for this mode before execute. */
export function assertOverlayToolAllowedForMode(mode: ToolMode, toolId: string): void {
  const allowed = mode === 'ask' ? OVERLAY_TOOL_IDS_ASK : OVERLAY_TOOL_IDS_ACT
  if (!allowed.has(toolId)) {
    throw new Error(`[tools] Tool "${toolId}" is not allowed in ${mode} mode`)
  }
}
