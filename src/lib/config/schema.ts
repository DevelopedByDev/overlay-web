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
  auth: z.object({
    provider: z.enum(['workos', 'keycloak', 'saml', 'oidc']).default('workos'),
    sessionTTLMinutes: z.number().int().min(1).default(43_200),
    mfaRequired: z.boolean().default(false),
    allowedRedirectOrigins: z.array(Url).default([]),
  }).default({}),
  ai: z.object({
    gateway: z.enum(['vercel', 'ollama', 'vllm']).default('vercel'),
    fallbackProvider: z.enum(['vercel', 'ollama', 'vllm']).optional(),
    ollama: z.object({
      baseUrl: Url.default('http://localhost:11434'),
      defaultModel: z.string().default('llama3.1'),
    }).default({}),
    vllm: z.object({
      baseUrl: Url.default('http://localhost:8000'),
      defaultModel: z.string().default('meta-llama/Llama-3.1-8B-Instruct'),
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
    provider: z.enum(['r2', 'minio', 's3']).default('minio'),
    publicUrlTtlSeconds: z.number().int().min(1).default(3600),
    maxUploadSizeBytes: z.number().int().min(1).default(104_857_600),
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
})

export type OverlayConfigType = z.infer<typeof OverlayConfig>
