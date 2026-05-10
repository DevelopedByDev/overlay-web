// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Plugin loader + auth layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type { PluginManifest } from './manifest'

export const PluginPermission = {
  'read:conversations': 'read:conversations',
  'write:conversations': 'write:conversations',
  'read:memories': 'read:memories',
  'write:memories': 'write:memories',
  'read:files': 'read:files',
  'write:files': 'write:files',
  'read:users': 'read:users',
  'write:users': 'write:users',
  'read:audit': 'read:audit',
  'admin:settings': 'admin:settings',
} as const

export type PluginPermission = keyof typeof PluginPermission

export function validatePermissions(
  requested: string[],
  _manifest: PluginManifest
): { valid: boolean; invalid: string[] } {
  const known = new Set(Object.keys(PluginPermission))
  const invalid = requested.filter((p) => !known.has(p))
  return { valid: invalid.length === 0, invalid }
}
