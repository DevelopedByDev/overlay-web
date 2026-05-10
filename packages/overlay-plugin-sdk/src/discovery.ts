// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Plugin loader (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type { PluginManifest } from './manifest'

export interface PluginDiscoveryConfig {
  localPaths: string[]
  npmScopes: string[]
  npmPrefixes: string[]
}

export interface DiscoveredPlugin {
  manifest: PluginManifest
  resolvedPath: string
  source: 'local' | 'npm'
}

export function discoverPlugins(_config: PluginDiscoveryConfig): DiscoveredPlugin[] {
  // Placeholder: will scan filesystem and node_modules in Phase 4
  return []
}
