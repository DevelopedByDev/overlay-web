import type { ToolMode } from './types'

/** Max model tool rounds (steps) for Ask mode (streamText / agent). */
export const MAX_TOOL_STEPS_ASK = 10

/** Max model tool rounds for Act mode — act/route.ts ToolLoopAgent uses this. */
export const MAX_TOOL_STEPS_ACT = 12

const GENERATION_TOOL_IDS = new Set<string>([
  'generate_image',
  'generate_video',
  'animate_image',
  'generate_video_with_reference',
  'apply_motion_control',
  'edit_video',
])

const OVERLAY_TOOL_IDS_ASK = new Set<string>([
  'search_knowledge',
  'search_in_files',
  'save_memory',
  'update_memory',
  'delete_memory',
  'interactive_browser_session',
  'list_notes',
  'get_note',
  'list_skills',
  ...GENERATION_TOOL_IDS,
])

const OVERLAY_TOOL_IDS_ACT = new Set<string>([
  'search_knowledge',
  'search_in_files',
  'save_memory',
  'update_memory',
  'delete_memory',
  'browser_run_task',
  'interactive_browser_session',
  'run_daytona_sandbox',
  'list_notes',
  'get_note',
  'create_note',
  'update_note',
  'delete_note',
  'list_skills',
  'draft_automation_from_chat',
  'draft_skill_from_chat',
  ...GENERATION_TOOL_IDS,
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
