// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: App initialization (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import { z } from 'zod'

export const OverlayConfigSchema = z.object({
  version: z.literal('1.0'),
  providers: z.object({
    database: z.enum(['convex', 'postgres', 'sqlite', 'memory']).default('convex'),
    auth: z.enum(['workos', 'oidc', 'saml', 'ldap', 'local']).default('workos'),
    storage: z.enum(['r2', 's3', 'minio', 'local', 'memory']).default('r2'),
    aiGateway: z
      .enum(['vercel-ai', 'openrouter', 'ollama', 'vllm', 'azure-openai'])
      .default('vercel-ai'),
    billing: z.enum(['stripe', 'disabled', 'manual']).default('stripe'),
    queue: z.enum(['convex', 'bullmq', 'redis', 'memory']).default('convex'),
    search: z.enum(['convex', 'meilisearch', 'elasticsearch', 'memory']).default('convex'),
  }),
  plugins: z
    .object({
      localPaths: z.array(z.string()).default(['./plugins']),
      enabled: z.array(z.string()).default([]),
    })
    .optional(),
  enterprise: z
    .object({
      whiteLabel: z
        .object({
          logo: z.string().optional(),
          primaryColor: z.string().optional(),
          fontFamily: z.string().optional(),
        })
        .optional(),
      rbac: z
        .object({
          enabled: z.boolean().default(false),
          defaultRole: z.enum(['superadmin', 'admin', 'user', 'guest']).default('user'),
        })
        .optional(),
      auditLog: z
        .object({
          enabled: z.boolean().default(false),
          retentionDays: z.number().default(90),
        })
        .optional(),
    })
    .optional(),
})

export type OverlayConfig = z.infer<typeof OverlayConfigSchema>

export function parseOverlayConfig(raw: unknown): OverlayConfig {
  return OverlayConfigSchema.parse(raw)
}
