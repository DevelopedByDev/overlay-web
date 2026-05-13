import { z } from 'zod'

const Url = z.string().url()
const RateLimitWindow = z.object({
  windowMs: z.number().int().min(1).default(60_000),
  maxRequests: z.number().int().min(1).default(30),
})

export const OverlayConfig = z.object({
  version: z.string().default('1.0.0'),
  deployment: z.object({
    mode: z.enum(['saas', 'self-hosted', 'hybrid']).default('self-hosted'),
    domain: Url.default('http://localhost:3000'),
    tls: z.enum(['auto', 'manual', 'off']).default('auto'),
    trustProxyHeaders: z.boolean().default(false),
  }).default({}),
  providers: z.object({
    database: z.enum(['convex', 'postgres', 'sqlite', 'memory']).default('convex'),
    auth: z.enum(['workos', 'oidc', 'saml', 'ldap', 'local', 'keycloak']).default('workos'),
    storage: z.enum(['r2', 's3', 'minio', 'local', 'memory']).default('r2'),
    aiGateway: z.enum(['vercel-ai', 'openrouter', 'ollama', 'vllm', 'azure-openai']).default('vercel-ai'),
    billing: z.enum(['stripe', 'disabled', 'manual']).default('stripe'),
    cache: z.enum(['memory', 'redis', 'valkey']).default('memory'),
    queue: z.enum(['convex', 'bullmq', 'redis', 'memory']).default('convex'),
    search: z.enum(['convex', 'meilisearch', 'elasticsearch', 'memory']).default('convex'),
  }).default({}),
  database: z.object({
    convex: z.object({
      url: Url.optional(),
    }).default({}),
    postgres: z.object({
      url: z.string().min(1).optional(),
      migrationsTable: z.string().default('__overlay_migrations'),
      migrationMode: z.enum(['manual', 'startup']).default('manual'),
      pool: z.object({
        max: z.number().int().min(1).default(10),
        idleTimeoutMillis: z.number().int().min(1_000).default(30_000),
      }).default({}),
    }).default({}),
  }).default({}),
  auth: z.object({
    provider: z.enum(['workos', 'keycloak', 'saml', 'oidc', 'ldap', 'local']).default('workos'),
    sessionTTLMinutes: z.number().int().min(1).default(43_200),
    mfaRequired: z.boolean().default(false),
    allowedRedirectOrigins: z.array(Url).default([]),
    oidc: z.object({
      issuer: Url.optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      scopes: z.array(z.string()).default(['openid', 'email', 'profile']),
      groupClaim: z.string().default('groups'),
      roleClaim: z.string().default('roles'),
    }).default({}),
    saml: z.object({
      metadataUrl: Url.optional(),
      metadataXml: z.string().optional(),
      entryPoint: Url.optional(),
      issuer: z.string().optional(),
      cert: z.string().optional(),
      groupAttribute: z.string().default('groups'),
      roleAttribute: z.string().default('roles'),
    }).default({}),
    roleMapping: z.record(z.string()).default({}),
    defaultRole: z.enum(['superadmin', 'admin', 'user', 'guest']).default('user'),
  }).default({}),
  ai: z.object({
    gateway: z.enum(['vercel', 'vercel-ai', 'openrouter', 'ollama', 'vllm', 'azure-openai']).default('vercel'),
    fallbackProvider: z.enum(['vercel', 'vercel-ai', 'openrouter', 'ollama', 'vllm', 'azure-openai']).optional(),
    vercel: z.object({
      baseUrl: Url.default('https://ai-gateway.vercel.sh/v1'),
      apiKey: z.string().optional(),
    }).default({}),
    openrouter: z.object({
      baseUrl: Url.default('https://openrouter.ai/api/v1'),
      apiKey: z.string().optional(),
    }).default({}),
    ollama: z.object({
      baseUrl: Url.default('http://localhost:11434/v1'),
      defaultModel: z.string().default('llama3.1'),
      imageEndpoint: Url.optional(),
      videoEndpoint: Url.optional(),
    }).default({}),
    vllm: z.object({
      baseUrl: Url.default('http://localhost:8000/v1'),
      defaultModel: z.string().default('meta-llama/Llama-3.1-8B-Instruct'),
      apiKey: z.string().optional(),
      imageEndpoint: Url.optional(),
      videoEndpoint: Url.optional(),
    }).default({}),
    modelTiering: z.object({
      free: z.array(z.string()).default([]),
      cheap: z.array(z.string()).default([]),
      premium: z.array(z.string()).default([]),
    }).default({}),
  }).default({}),
  billing: z.object({
    provider: z.enum(['stripe', 'none']).default('stripe'),
    currency: z.enum(['usd', 'eur', 'gbp']).default('usd'),
    markupBasisPoints: z.number().int().min(0).default(2500),
    autoTopUp: z.object({
      enabled: z.boolean().default(false),
      thresholdCents: z.number().int().min(0).default(1_000),
      amountCents: z.number().int().min(0).default(2_000),
    }).optional(),
  }).default({}),
  storage: z.object({
    provider: z.enum(['r2', 'minio', 's3', 'local', 'memory']).default('minio'),
    publicUrlTtlSeconds: z.number().int().min(1).default(3600),
    maxUploadSizeBytes: z.number().int().min(1).default(104_857_600),
    r2: z.object({
      accountId: z.string().optional(),
      bucket: z.string().optional(),
      endpoint: Url.optional(),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
    }).default({}),
    s3: z.object({
      bucket: z.string().optional(),
      endpoint: Url.optional(),
      region: z.string().default('us-east-1'),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      forcePathStyle: z.boolean().default(false),
    }).default({}),
    minio: z.object({
      bucket: z.string().default('overlay'),
      endpoint: Url.default('http://localhost:9000'),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
    }).default({}),
    local: z.object({
      rootDir: z.string().default('./data/storage'),
      publicBasePath: z.string().default('/api/storage/local'),
    }).default({}),
  }).default({}),
  cache: z.object({
    redis: z.object({
      url: z.string().default('redis://localhost:6379'),
    }).default({}),
    valkey: z.object({
      url: z.string().default('redis://localhost:6379'),
    }).default({}),
  }).default({}),
  rateLimit: z.object({
    auth: RateLimitWindow.default({ windowMs: 60_000, maxRequests: 10 }),
    ai: RateLimitWindow.default({ windowMs: 60_000, maxRequests: 30 }),
    storage: RateLimitWindow.default({ windowMs: 60_000, maxRequests: 60 }),
  }).default({}),
  security: z.object({
    cspEnforce: z.boolean().default(true),
    allowedFrameAncestors: z.array(z.string()).default([]),
    sessionCookie: z.object({
      secure: z.boolean().default(true),
      httpOnly: z.boolean().default(true),
      sameSite: z.enum(['strict', 'lax', 'none']).default('lax'),
    }).default({}),
  }).default({}),
  whiteLabel: z.object({
    appName: z.string().default('Overlay'),
    logoUrl: z.string().default('/logo.svg'),
    faviconUrl: z.string().default('/favicon.svg'),
    primaryColor: z.string().default('#0A0A0A'),
    accentColor: z.string().default('#3B82F6'),
    fontFamily: z.string().default('Inter, system-ui, sans-serif'),
  }).default({}),
  rbac: z.object({
    roles: z.record(z.object({
      inherits: z.string().optional(),
      permissions: z.array(z.string()).default([]),
    })).default({}),
    contentFilter: z.record(z.object({
      allowedModels: z.array(z.string()).default([]),
      blockedTools: z.array(z.string()).default([]),
    })).default({}),
  }).default({}),
  audit: z.object({
    retentionDays: z.number().int().min(1).default(90),
    exportFormat: z.enum(['jsonl', 'csv']).default('jsonl'),
    forwarders: z.array(z.object({
      type: z.literal('webhook'),
      url: Url,
    })).default([]),
  }).default({}),
  enterprise: z.object({
    airGapped: z.boolean().default(false),
    externalEgressAllowlist: z.array(Url).default([]),
    license: z.object({
      key: z.string().optional(),
      file: z.string().optional(),
      publicKey: z.string().optional(),
      gracePeriodDays: z.number().int().min(0).default(14),
    }).default({}),
    smtp: z.object({
      host: z.string().optional(),
      port: z.number().int().min(1).max(65535).default(587),
      secure: z.boolean().default(false),
      username: z.string().optional(),
      password: z.string().optional(),
      from: z.string().optional(),
      heloName: z.string().default('overlay.local'),
    }).default({}),
    groupRoleMapping: z.record(z.enum(['superadmin', 'admin', 'user', 'guest'])).default({}),
  }).default({}),
})

export type OverlayConfigType = z.infer<typeof OverlayConfig>
