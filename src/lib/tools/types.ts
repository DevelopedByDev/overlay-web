/**
 * Unified overlay-native tools (Ask ⊂ Act). See build.ts for composition.
 *
 * Phase 0 inventory:
 * - search_knowledge: ask + act (hybrid search via /api/app/knowledge/search)
 * - list_notes, get_note: ask + act; create/update/delete_note: act only
 * - list_computer_instances, get_computer_by_name: ask + act (Convex list / name lookup)
 * - Computer *: read tools ask + act; session/workspace writes + run_computer_gateway_command: act only
 * - save_memory, update_memory, delete_memory: ask + act (/api/app/memory)
 * - generate_image, generate_video: act only (/api/app/generate-*)
 * Composio: act + filtered ask (unchanged in composio-tools); merged in routes.
 */

export type ToolMode = 'ask' | 'act'

export type ToolCategory = 'knowledge' | 'memory' | 'media' | 'notes' | 'computer'

export interface OverlayToolsOptions {
  userId: string
  accessToken?: string
  conversationId?: string
  projectId?: string
  baseUrl?: string
  /** Original browser Cookie header — required for server-side tool `fetch` to `/api/app/*` (middleware expects session cookie). */
  forwardCookie?: string
}
