import { z } from 'zod'

export const OverlayDeploymentEnvironmentSchema = z.enum([
  'development',
  'test',
  'preview',
  'staging',
  'production',
  'onprem',
])

export const OverlayAuthProviderSchema = z.enum(['workos', 'oidc', 'keycloak', 'none'])
export const OverlayBillingProviderSchema = z.enum(['stripe', 'none'])
export const OverlayStorageProviderSchema = z.enum(['r2', 's3', 'minio', 'none'])
export const OverlayLlmGatewayProviderSchema = z.enum([
  'openrouter',
  'ai-gateway',
  'openai',
  'anthropic',
  'groq',
  'none',
])
export const OverlayProviderKeySourceSchema = z.enum(['env', 'workos-vault', 'config', 'none'])
export const OverlayPublicUrlPolicySchema = z.enum(['proxy', 'presigned', 'public'])
export const OverlayStripeModeSchema = z.enum(['test', 'live', 'unknown'])

const SecretLikePublicValuePattern =
  /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|ovl_sk_[A-Za-z0-9]|(?:api[_-]?key|secret|token)=/i

const OptionalStringSchema = z.string().trim().min(1).optional()
const OptionalUrlSchema = z.string().trim().url().optional()

export const OverlayRuntimeConfigSchema = z
  .object({
    app: z.object({
      baseUrl: z.string().trim().url(),
      deploymentEnvironment: OverlayDeploymentEnvironmentSchema,
      cspConnectSrc: z.array(z.string().trim().min(1)).default([]),
      publicEnv: z.record(z.string()).default({}),
    }),
    auth: z.object({
      provider: OverlayAuthProviderSchema,
      allowDevFallbacks: z.boolean().default(false),
      workos: z
        .object({
          clientId: OptionalStringSchema,
          apiKey: OptionalStringSchema,
          devClientId: OptionalStringSchema,
          devApiKey: OptionalStringSchema,
          jwksBaseUrl: OptionalUrlSchema,
        })
        .default({}),
      oidc: z
        .object({
          issuerUrl: OptionalUrlSchema,
          clientId: OptionalStringSchema,
          clientSecret: OptionalStringSchema,
          audience: OptionalStringSchema,
        })
        .default({}),
      keycloak: z
        .object({
          issuerUrl: OptionalUrlSchema,
          clientId: OptionalStringSchema,
          clientSecret: OptionalStringSchema,
          realm: OptionalStringSchema,
        })
        .default({}),
    }),
    billing: z.object({
      provider: OverlayBillingProviderSchema,
      stripe: z
        .object({
          mode: OverlayStripeModeSchema.default('unknown'),
          secretKey: OptionalStringSchema,
          webhookSecret: OptionalStringSchema,
          paidUnitPriceId: OptionalStringSchema,
          topupUnitPriceId: OptionalStringSchema,
          portalConfigurationId: OptionalStringSchema,
        })
        .default({}),
    }),
    storage: z.object({
      provider: OverlayStorageProviderSchema,
      publicUrlPolicy: OverlayPublicUrlPolicySchema.default('presigned'),
      r2: z
        .object({
          accountId: OptionalStringSchema,
          bucketName: OptionalStringSchema,
          accessKeyId: OptionalStringSchema,
          secretAccessKey: OptionalStringSchema,
          endpointUrl: OptionalUrlSchema,
          globalBudgetBytes: z.number().int().positive().optional(),
          presignTtlSeconds: z.number().int().positive().optional(),
        })
        .default({}),
      s3: z
        .object({
          bucketName: OptionalStringSchema,
          region: OptionalStringSchema,
          endpointUrl: OptionalUrlSchema,
          accessKeyId: OptionalStringSchema,
          secretAccessKey: OptionalStringSchema,
          forcePathStyle: z.boolean().optional(),
        })
        .default({}),
    }),
    llm: z.object({
      gatewayProvider: OverlayLlmGatewayProviderSchema,
      keySource: OverlayProviderKeySourceSchema.default('env'),
      defaultChatModelId: OptionalStringSchema,
      modelAllowlist: z.array(z.string().trim().min(1)).default([]),
      apiKeyEnvVar: OptionalStringSchema,
    }),
    database: z.object({
      provider: z.literal('convex').default('convex'),
      convexUrl: OptionalUrlSchema,
      deployment: OptionalStringSchema,
      internalApiSecret: OptionalStringSchema,
      internalServiceAuthSecret: OptionalStringSchema,
      apiKeyHashSecret: OptionalStringSchema,
    }),
    capabilities: z.object({
      billing: z.boolean().default(true),
      sso: z.boolean().default(true),
      apiKeys: z.boolean().default(false),
      webhooks: z.boolean().default(false),
      vectorSearch: z.boolean().default(true),
      automations: z.boolean().default(true),
      multiTenant: z.boolean().default(false),
    }),
  })
  .strict()
  .superRefine((config, ctx) => {
    for (const [key, value] of Object.entries(config.app.publicEnv)) {
      if (!key.startsWith('NEXT_PUBLIC_')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['app', 'publicEnv', key],
          message: 'Only NEXT_PUBLIC_* keys may be listed in app.publicEnv',
        })
      }
      if (isSecretLikePublicValue(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['app', 'publicEnv', key],
          message: `${key} appears to contain a secret value and must not be public`,
        })
      }
    }

    if (config.billing.provider === 'none' && config.capabilities.billing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capabilities', 'billing'],
        message: 'billing capability must be false when billing.provider is none',
      })
    }
    if (config.billing.provider === 'stripe' && !config.capabilities.billing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['billing', 'provider'],
        message: 'billing.provider must be none when billing capability is disabled',
      })
    }
    if (config.auth.provider === 'none' && config.capabilities.sso) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capabilities', 'sso'],
        message: 'sso capability must be false when auth.provider is none',
      })
    }
    if (config.capabilities.apiKeys && !config.database.apiKeyHashSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['database', 'apiKeyHashSecret'],
        message: 'API_KEY_HASH_SECRET is required when API key capability is enabled',
      })
    }
    if (config.capabilities.multiTenant) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capabilities', 'multiTenant'],
        message: 'multiTenant cannot be enabled until the Phase 6b tenant isolation work is implemented',
      })
    }

    const stagingLikeAppUrl = isStagingLikeUrl(config.app.baseUrl)
    if (stagingLikeAppUrl && isLiveStripeSecret(config.billing.stripe.secretKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['billing', 'stripe', 'secretKey'],
        message: 'Stripe live keys must not be used with staging or preview app URLs',
      })
    }

    if (usesProductionConvex(config.database) && usesDevWorkOsConfig(config.auth.workos)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['auth', 'workos'],
        message: 'Production Convex must not be paired with DEV_WORKOS_* credentials',
      })
    }

    if (config.app.deploymentEnvironment === 'production') {
      if (!isHttpsUrl(config.app.baseUrl) || isLocalUrl(config.app.baseUrl) || stagingLikeAppUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['app', 'baseUrl'],
          message: 'Production app.baseUrl must be the canonical HTTPS production URL',
        })
      }
      if (config.auth.provider === 'workos') {
        if (!config.auth.workos.clientId || !config.auth.workos.apiKey) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['auth', 'workos'],
            message: 'Production WorkOS auth requires WORKOS_CLIENT_ID and WORKOS_API_KEY',
          })
        }
        if (config.auth.allowDevFallbacks || usesDevWorkOsConfig(config.auth.workos)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['auth', 'allowDevFallbacks'],
            message: 'Production auth must not allow dev WorkOS fallback credentials',
          })
        }
      }
      if (config.billing.provider === 'stripe') {
        if (!isLiveStripeSecret(config.billing.stripe.secretKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['billing', 'stripe', 'secretKey'],
            message: 'Production Stripe billing requires a live STRIPE_SECRET_KEY',
          })
        }
        if (!config.billing.stripe.webhookSecret) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['billing', 'stripe', 'webhookSecret'],
            message: 'Production Stripe billing requires STRIPE_WEBHOOK_SECRET',
          })
        }
      }
      if (!config.database.convexUrl || !usesProductionConvex(config.database)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['database', 'convexUrl'],
          message: 'Production requires the production Convex deployment URL',
        })
      }
      if (!config.database.internalApiSecret || !config.database.internalServiceAuthSecret) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['database'],
          message: 'Production requires INTERNAL_API_SECRET and INTERNAL_SERVICE_AUTH_SECRET',
        })
      }
      if (
        config.database.internalApiSecret &&
        config.database.internalServiceAuthSecret &&
        config.database.internalApiSecret === config.database.internalServiceAuthSecret
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['database', 'internalServiceAuthSecret'],
          message: 'Production INTERNAL_SERVICE_AUTH_SECRET must differ from INTERNAL_API_SECRET',
        })
      }
    }
  })

export type OverlayRuntimeConfig = z.infer<typeof OverlayRuntimeConfigSchema>
export type OverlayRuntimeConfigInput = z.input<typeof OverlayRuntimeConfigSchema>
export type OverlayDeploymentEnvironment = z.infer<typeof OverlayDeploymentEnvironmentSchema>

export type OverlayRuntimeConfigPublicSummary = ReturnType<typeof redactOverlayRuntimeConfig>

export function parseOverlayRuntimeConfig(value: unknown): OverlayRuntimeConfig {
  return OverlayRuntimeConfigSchema.parse(value)
}

export function mergeOverlayRuntimeConfig(
  ...configs: Array<unknown | null | undefined>
): unknown {
  return configs.reduce<unknown>((merged, config) => deepMerge(merged, config ?? {}), {})
}

export function isRuntimeConfigSummaryVisible(config: OverlayRuntimeConfig): boolean {
  return config.app.deploymentEnvironment !== 'production'
}

export function redactOverlayRuntimeConfig(config: OverlayRuntimeConfig) {
  return {
    app: {
      baseUrl: config.app.baseUrl,
      deploymentEnvironment: config.app.deploymentEnvironment,
      cspConnectSrc: [...config.app.cspConnectSrc],
      publicEnvKeys: Object.keys(config.app.publicEnv).sort(),
    },
    auth: {
      provider: config.auth.provider,
      allowDevFallbacks: config.auth.allowDevFallbacks,
      workos: {
        hasClientId: Boolean(config.auth.workos.clientId),
        hasApiKey: Boolean(config.auth.workos.apiKey),
        hasDevClientId: Boolean(config.auth.workos.devClientId),
        hasDevApiKey: Boolean(config.auth.workos.devApiKey),
        jwksBaseUrl: config.auth.workos.jwksBaseUrl,
      },
      oidc: {
        issuerUrl: config.auth.oidc.issuerUrl,
        hasClientId: Boolean(config.auth.oidc.clientId),
        hasClientSecret: Boolean(config.auth.oidc.clientSecret),
        hasAudience: Boolean(config.auth.oidc.audience),
      },
      keycloak: {
        issuerUrl: config.auth.keycloak.issuerUrl,
        hasClientId: Boolean(config.auth.keycloak.clientId),
        hasClientSecret: Boolean(config.auth.keycloak.clientSecret),
        realm: config.auth.keycloak.realm,
      },
    },
    billing: {
      provider: config.billing.provider,
      stripe: {
        mode: config.billing.stripe.mode,
        hasSecretKey: Boolean(config.billing.stripe.secretKey),
        hasWebhookSecret: Boolean(config.billing.stripe.webhookSecret),
        hasPaidUnitPriceId: Boolean(config.billing.stripe.paidUnitPriceId),
        hasTopupUnitPriceId: Boolean(config.billing.stripe.topupUnitPriceId),
        hasPortalConfigurationId: Boolean(config.billing.stripe.portalConfigurationId),
      },
    },
    storage: {
      provider: config.storage.provider,
      publicUrlPolicy: config.storage.publicUrlPolicy,
      r2: {
        hasAccountId: Boolean(config.storage.r2.accountId),
        bucketName: config.storage.r2.bucketName,
        hasAccessKeyId: Boolean(config.storage.r2.accessKeyId),
        hasSecretAccessKey: Boolean(config.storage.r2.secretAccessKey),
        endpointUrl: config.storage.r2.endpointUrl,
        hasGlobalBudgetBytes: config.storage.r2.globalBudgetBytes !== undefined,
        presignTtlSeconds: config.storage.r2.presignTtlSeconds,
      },
      s3: {
        bucketName: config.storage.s3.bucketName,
        region: config.storage.s3.region,
        endpointUrl: config.storage.s3.endpointUrl,
        hasAccessKeyId: Boolean(config.storage.s3.accessKeyId),
        hasSecretAccessKey: Boolean(config.storage.s3.secretAccessKey),
        forcePathStyle: config.storage.s3.forcePathStyle,
      },
    },
    llm: {
      gatewayProvider: config.llm.gatewayProvider,
      keySource: config.llm.keySource,
      defaultChatModelId: config.llm.defaultChatModelId,
      modelAllowlist: [...config.llm.modelAllowlist],
      apiKeyEnvVar: config.llm.apiKeyEnvVar,
    },
    database: {
      provider: config.database.provider,
      convexUrl: config.database.convexUrl,
      deployment: config.database.deployment,
      hasInternalApiSecret: Boolean(config.database.internalApiSecret),
      hasInternalServiceAuthSecret: Boolean(config.database.internalServiceAuthSecret),
      hasApiKeyHashSecret: Boolean(config.database.apiKeyHashSecret),
    },
    capabilities: { ...config.capabilities },
  }
}

export function isSecretLikePublicValue(value: string): boolean {
  return SecretLikePublicValuePattern.test(value.trim())
}

export function isLiveStripeSecret(value: string | undefined): boolean {
  const normalized = value?.trim() ?? ''
  return normalized.startsWith('sk_live_') || normalized.startsWith('rk_live_')
}

export function inferStripeMode(value: string | undefined): z.infer<typeof OverlayStripeModeSchema> {
  const normalized = value?.trim() ?? ''
  if (normalized.startsWith('sk_live_') || normalized.startsWith('rk_live_')) return 'live'
  if (normalized.startsWith('sk_test_') || normalized.startsWith('rk_test_')) return 'test'
  return 'unknown'
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function isLocalUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

function isStagingLikeUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return (
      hostname.includes('staging') ||
      hostname.includes('preview') ||
      hostname.includes('vercel.app') ||
      hostname.includes('localhost')
    )
  } catch {
    return false
  }
}

function usesProductionConvex(database: OverlayRuntimeConfig['database']): boolean {
  const deployment = database.deployment?.trim() ?? ''
  const convexUrl = database.convexUrl?.trim() ?? ''
  return deployment.startsWith('prod:') || convexUrl.includes('colorful-chickadee-419')
}

function usesDevWorkOsConfig(workos: OverlayRuntimeConfig['auth']['workos']): boolean {
  return Boolean(workos.devClientId || workos.devApiKey)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMerge(left: unknown, right: unknown): unknown {
  if (!isPlainObject(left)) return cloneConfigValue(right)
  if (!isPlainObject(right)) return cloneConfigValue(left)

  const merged: Record<string, unknown> = { ...left }
  for (const [key, value] of Object.entries(right)) {
    if (value === undefined) continue
    const existing = merged[key]
    merged[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? deepMerge(existing, value)
        : cloneConfigValue(value)
  }
  return merged
}

function cloneConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) return [...value]
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneConfigValue(entry)]))
  }
  return value
}
