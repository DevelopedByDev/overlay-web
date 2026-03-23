import type { ToolSet } from 'ai'
import { buildOverlayToolSet } from '@/lib/tools/build'
import type { OverlayToolsOptions } from '@/lib/tools/types'

export type { OverlayToolsOptions as WebToolsOptions }

/**
 * Act-mode overlay tools (knowledge, memory CRUD, image/video generation).
 * Prefer importing buildOverlayToolSet(mode, options) from @/lib/tools/build when mode varies.
 */
export function createWebTools(options: OverlayToolsOptions): ToolSet {
  return buildOverlayToolSet('act', options)
}
