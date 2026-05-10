// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Plugin loader (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type { PluginContext } from '@overlay/plugin-sdk'
import type { LoadedPlugin, SandboxConfig } from './types'

export interface IPluginLoader {
  scan(): Promise<LoadedPlugin[]>
  load(plugin: LoadedPlugin): Promise<LoadedPlugin>
  unload(pluginId: string): Promise<void>
  getLoadedPlugins(): LoadedPlugin[]
  getPluginContext(pluginId: string): PluginContext
  validateManifest(manifest: unknown): { valid: boolean; errors: string[] }
}

export interface PluginSandbox {
  run<T>(fn: () => Promise<T>, config: SandboxConfig): Promise<T>
}
