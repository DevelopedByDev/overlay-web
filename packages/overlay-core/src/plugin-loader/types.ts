// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Plugin loader (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type { PluginManifest } from '@overlay/plugin-sdk'

export interface LoadedPlugin {
  manifest: PluginManifest
  resolvedPath: string
  source: 'local' | 'npm'
  enabled: boolean
  config?: Record<string, unknown>
}

export interface SandboxConfig {
  maxMemoryMB: number
  maxExecutionTimeMs: number
  allowedPermissions: string[]
  filesystemAccess: 'none' | 'own-directory' | 'read-all'
  networkAccess: 'none' | 'outbound-only' | 'unrestricted'
}
