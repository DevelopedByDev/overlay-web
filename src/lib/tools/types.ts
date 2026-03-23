/**
 * Unified overlay-native tools (Ask ⊂ Act). See build.ts for composition.
 *
 * Phase 0 inventory:
 * - search_knowledge: ask + act (hybrid search via /api/app/knowledge/search)
 * - save_memory, update_memory, delete_memory: act only (/api/app/memory)
 * - generate_image, generate_video: act only (/api/app/generate-*)
 * Composio: act + filtered ask (unchanged in composio-tools); merged in routes.
 */

export type ToolMode = 'ask' | 'act'

export type ToolCategory = 'knowledge' | 'memory' | 'media'

export interface OverlayToolsOptions {
  userId: string
  accessToken?: string
  conversationId?: string
  projectId?: string
  baseUrl?: string
}
