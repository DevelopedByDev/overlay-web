// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: App initialization (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import { z } from 'zod'

export const OverlayConfigSchema = z.object({
  version: z.literal('1.0'),
  deployment: z
    .object({
      mode: z.enum(['saas', 'self-hosted', 'hybrid']).default('saas'),
      domain: z.string().url().default('http://localhost:3000'),
      trustProxyHeaders: z.boolean().default(false),
    })
    .default({}),
  providers: z.object({
    database: z.enum(['convex', 'postgres', 'sqlite', 'memory']).default('convex'),
    auth: z.enum(['workos', 'oidc', 'saml', 'ldap', 'local']).default('workos'),
    storage: z.enum(['r2', 's3', 'minio', 'local', 'memory']).default('r2'),
    aiGateway: z
      .enum(['vercel-ai', 'openrouter', 'ollama', 'vllm', 'azure-openai'])
      .default('vercel-ai'),
    billing: z.enum(['stripe', 'disabled', 'manual']).default('stripe'),
    cache: z.enum(['memory', 'redis', 'valkey']).default('memory'),
    queue: z.enum(['convex', 'bullmq', 'redis', 'memory']).default('convex'),
    search: z.enum(['convex', 'meilisearch', 'elasticsearch', 'memory']).default('convex'),
  }),
  database: z
    .object({
      convex: z
        .object({
          url: z.string().url().optional(),
        })
        .default({}),
      postgres: z
        .object({
          url: z.string().min(1).optional(),
          migrationsTable: z.string().default('__overlay_migrations'),
          migrationMode: z.enum(['manual', 'startup']).default('manual'),
          pool: z
            .object({
              max: z.number().int().min(1).default(10),
              idleTimeoutMillis: z.number().int().min(1_000).default(30_000),
            })
            .default({}),
        })
        .default({}),
    })
    .default({}),
  auth: z
    .object({
      workos: z
        .object({
          clientId: z.string().optional(),
          apiKey: z.string().optional(),
        })
        .default({}),
      oidc: z
        .object({
          issuer: z.string().url().optional(),
          clientId: z.string().optional(),
          clientSecret: z.string().optional(),
          scopes: z.array(z.string()).default(['openid', 'email', 'profile']),
          groupClaim: z.string().default('groups'),
          roleClaim: z.string().default('roles'),
        })
        .default({}),
      saml: z
        .object({
          metadataUrl: z.string().url().optional(),
          metadataXml: z.string().optional(),
          entryPoint: z.string().url().optional(),
          issuer: z.string().optional(),
          cert: z.string().optional(),
          groupAttribute: z.string().default('groups'),
          roleAttribute: z.string().default('roles'),
        })
        .default({}),
      sessionTTLMinutes: z.number().int().min(1).default(43_200),
      roleMapping: z.record(z.string()).default({}),
      defaultRole: z.enum(['superadmin', 'admin', 'user', 'guest']).default('user'),
    })
    .default({}),
  storage: z
    .object({
      publicUrlTtlSeconds: z.number().int().min(1).default(900),
      r2: z
        .object({
          accountId: z.string().optional(),
          bucket: z.string().optional(),
          endpoint: z.string().url().optional(),
          accessKeyId: z.string().optional(),
          secretAccessKey: z.string().optional(),
        })
        .default({}),
      s3: z
        .object({
          bucket: z.string().optional(),
          endpoint: z.string().url().optional(),
          region: z.string().default('us-east-1'),
          accessKeyId: z.string().optional(),
          secretAccessKey: z.string().optional(),
          forcePathStyle: z.boolean().default(false),
        })
        .default({}),
      minio: z
        .object({
          bucket: z.string().default('overlay'),
          endpoint: z.string().url().default('http://localhost:9000'),
          accessKeyId: z.string().optional(),
          secretAccessKey: z.string().optional(),
        })
        .default({}),
      local: z
        .object({
          rootDir: z.string().default('./data/storage'),
          publicBasePath: z.string().default('/api/storage/local'),
        })
        .default({}),
    })
    .default({}),
  ai: z
    .object({
      vercel: z
        .object({
          baseUrl: z.string().url().default('https://ai-gateway.vercel.sh/v1'),
          apiKey: z.string().optional(),
        })
        .default({}),
      openrouter: z
        .object({
          baseUrl: z.string().url().default('https://openrouter.ai/api/v1'),
          apiKey: z.string().optional(),
        })
        .default({}),
      ollama: z
        .object({
          baseUrl: z.string().url().default('http://localhost:11434/v1'),
          defaultModel: z.string().default('llama3.1'),
          imageEndpoint: z.string().url().optional(),
          videoEndpoint: z.string().url().optional(),
        })
        .default({}),
      vllm: z
        .object({
          baseUrl: z.string().url().default('http://localhost:8000/v1'),
          defaultModel: z.string().default('meta-llama/Llama-3.1-8B-Instruct'),
          apiKey: z.string().optional(),
          imageEndpoint: z.string().url().optional(),
          videoEndpoint: z.string().url().optional(),
        })
        .default({}),
    })
    .default({}),
  billing: z
    .object({
      disabled: z
        .object({
          tier: z.enum(['free', 'pro', 'max']).default('max'),
          budgetTotalCents: z.number().int().min(0).default(1_000_000_000),
        })
        .default({}),
    })
    .default({}),
  cache: z
    .object({
      redis: z
        .object({
          url: z.string().default('redis://localhost:6379'),
        })
        .default({}),
      valkey: z
        .object({
          url: z.string().default('redis://localhost:6379'),
        })
        .default({}),
    })
    .default({}),
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
  const config = OverlayConfigSchema.parse(raw)

  if (config.deployment.mode === 'self-hosted' && config.providers.database === 'convex') {
    throw new Error('Self-hosted deployments must set providers.database to postgres, sqlite, or memory.')
  }

  if (config.providers.database === 'postgres' && !config.database.postgres.url) {
    throw new Error('providers.database=postgres requires database.postgres.url or DATABASE_URL.')
  }

  if ((config.providers.auth === 'oidc' || config.providers.auth === 'ldap') && !config.auth.oidc.issuer) {
    throw new Error('OIDC auth requires auth.oidc.issuer.')
  }

  if (config.providers.auth === 'saml' && !config.auth.saml.metadataUrl && !config.auth.saml.metadataXml && !config.auth.saml.entryPoint) {
    throw new Error('SAML auth requires auth.saml.metadataUrl, auth.saml.metadataXml, or auth.saml.entryPoint.')
  }

  return config
}
