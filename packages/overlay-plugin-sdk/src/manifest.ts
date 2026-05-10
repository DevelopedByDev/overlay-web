// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Plugin loader (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import { z } from 'zod'

export const PluginCapability = z.enum([
  'tool',
  'ui-panel',
  'auth-provider',
  'storage-provider',
  'db-provider',
  'ai-provider',
  'billing-provider',
  'queue-provider',
  'search-provider',
  'theme',
  'webhook',
])

export type PluginCapability = z.infer<typeof PluginCapability>

export const ConfigFieldSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  required: z.boolean().default(false),
  secret: z.boolean().default(false),
  description: z.string().optional(),
  default: z.unknown().optional(),
})

export type ConfigField = z.infer<typeof ConfigFieldSchema>

export const PluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/),
  name: z.string().min(1).max(64),
  version: z.string(),
  description: z.string().optional(),
  entrypoints: z.object({
    server: z.string().optional(),
    client: z.string().optional(),
  }),
  capabilities: z.array(PluginCapability).min(1),
  permissions: z.array(z.string()).default([]),
  configSchema: z.record(ConfigFieldSchema).optional(),
  dependencies: z.array(z.string()).optional(),
})

export type PluginManifest = z.infer<typeof PluginManifestSchema>
