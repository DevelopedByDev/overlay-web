import 'server-only'

import type { ToolSet } from 'ai'
import { buildOverlayToolSet } from '@/server/tools/tools/build'
import type { OverlayToolsOptions } from '@/server/tools/tools/types'

export type { OverlayToolsOptions as WebToolsOptions }

/**
 * Overlay agent tools (knowledge, memory CRUD, browser, image/video generation).
 */
export function createWebTools(options: OverlayToolsOptions): ToolSet {
  return buildOverlayToolSet(options)
}
