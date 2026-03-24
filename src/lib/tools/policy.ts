import type { ToolMode } from './types'

/** Max model tool rounds (steps) for Ask mode (streamText / agent). */
export const MAX_TOOL_STEPS_ASK = 10

/** Max model tool rounds for Act mode — act/route.ts ToolLoopAgent uses this. */
export const MAX_TOOL_STEPS_ACT = 12

const OVERLAY_TOOL_IDS_ASK = new Set<string>([
  'search_knowledge',
  'save_memory',
  'update_memory',
  'delete_memory',
  'list_notes',
  'get_note',
  'list_computer_sessions',
  'get_computer_session_messages',
  'list_computer_workspace_files',
  'read_computer_workspace_file',
])

const OVERLAY_TOOL_IDS_ACT = new Set<string>([
  'search_knowledge',
  'save_memory',
  'update_memory',
  'delete_memory',
  'generate_image',
  'generate_video',
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
