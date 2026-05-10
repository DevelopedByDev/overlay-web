// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Plugin loader (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import { PluginManifestSchema, type PluginManifest } from './manifest'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateManifest(manifest: unknown): ValidationResult {
  const result = PluginManifestSchema.safeParse(manifest)
  if (result.success) {
    return { valid: true, errors: [] }
  }
  return {
    valid: false,
    errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  }
}

export function isValidManifest(manifest: unknown): manifest is PluginManifest {
  return PluginManifestSchema.safeParse(manifest).success
}
