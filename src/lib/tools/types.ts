/**
 * Unified overlay-native tools (Act agent). See build.ts for composition.
 *
 * Composio tools are merged in act/route.ts (full set for paid; filtered for free tier).
 */

export type ToolCategory = 'knowledge' | 'memory' | 'media' | 'notes'

export interface OverlayToolsOptions {
  userId: string
  accessToken?: string
  serverSecret?: string
  conversationId?: string
  turnId?: string
  projectId?: string
  baseUrl?: string
  allowedToolIds?: readonly string[]
  /** Original browser Cookie header — required for server-side tool `fetch` to `/api/app/*` (middleware expects session cookie). */
  forwardCookie?: string
  /**
   * When `false`, omits paid-only tools (remote browser session, Daytona workspace sandbox). Default: include them.
   * Free tier should pass `false`.
   */
  includePaidOnlyOverlayTools?: boolean
}
