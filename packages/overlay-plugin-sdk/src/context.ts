// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Plugin sandbox (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type { PluginPermission } from './permissions'

export interface PluginContext {
  pluginId: string
  config: Record<string, unknown>
  getSecret(key: string): string | undefined
  hasPermission(permission: PluginPermission): boolean

  db: {
    findConversation(id: string): Promise<unknown | null>
    listConversations(userId: string): Promise<unknown[]>
  }

  log: {
    info(message: string, meta?: Record<string, unknown>): void
    error(message: string, meta?: Record<string, unknown>): void
    warn(message: string, meta?: Record<string, unknown>): void
    debug(message: string, meta?: Record<string, unknown>): void
  }
}
