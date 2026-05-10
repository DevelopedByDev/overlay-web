// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Plugin loader — server-side entrypoints (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type {
  ToolDefinition,
  AuthProviderDefinition,
  StorageProviderDefinition,
  AIProviderDefinition,
} from './capabilities'

export function defineTool(def: ToolDefinition): ToolDefinition {
  return def
}

export function defineAuthProvider(def: AuthProviderDefinition): AuthProviderDefinition {
  return def
}

export function defineStorageProvider(def: StorageProviderDefinition): StorageProviderDefinition {
  return def
}

export function defineAIProvider(def: AIProviderDefinition): AIProviderDefinition {
  return def
}
