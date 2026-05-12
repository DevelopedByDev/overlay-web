import { loadConfig } from './loader'
import type { OverlayConfigType } from './schema'

let cachedConfig: OverlayConfigType | null = null

export function getConfig(): OverlayConfigType {
  if (!cachedConfig) cachedConfig = loadConfig()
  return cachedConfig
}

export function resetConfigForTests(): void {
  cachedConfig = null
}
