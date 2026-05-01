/** Max model tool rounds — ToolLoopAgent (act) uses this. */
export const MAX_TOOL_STEPS_ACT = 12

const GENERATION_TOOL_IDS = new Set<string>([
  'generate_image',
  'generate_video',
  'animate_image',
  'generate_video_with_reference',
  'apply_motion_control',
  'edit_video',
])

const OVERLAY_TOOL_IDS = new Set<string>([
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
  'draft_skill_from_chat',
  'list_automations',
  'draft_automation_from_chat',
  'create_automation',
  'update_automation',
  'pause_automation',
  'delete_automation',
  ...GENERATION_TOOL_IDS,
])

export function overlayToolIdSet(): ReadonlySet<string> {
  return OVERLAY_TOOL_IDS
}

/** Defense in depth: ensure a tool id is registered before execute. */
export function assertOverlayToolAllowed(toolId: string): void {
  if (!OVERLAY_TOOL_IDS.has(toolId)) {
    throw new Error(`[tools] Tool "${toolId}" is not allowed`)
  }
}
