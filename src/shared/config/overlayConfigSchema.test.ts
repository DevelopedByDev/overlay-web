import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OverlayRuntimeConfigSchema,
  redactOverlayRuntimeConfig,
  type OverlayRuntimeConfigInput,
} from './overlayConfigSchema'

const minimalSaasConfig = {
  app: {
    baseUrl: 'https://staging.getoverlay.io',
    deploymentEnvironment: 'staging',
    cspConnectSrc: ['https://different-caiman-77.convex.cloud'],
    publicEnv: {
      NEXT_PUBLIC_APP_URL: 'https://staging.getoverlay.io',
      NEXT_PUBLIC_CONVEX_URL: 'https://different-caiman-77.convex.cloud',
    },
  },
  auth: {
    provider: 'workos',
    allowDevFallbacks: false,
    workos: {
      clientId: 'client_staging',
      apiKey: 'workos_staging_secret',
    },
    oidc: {},
    keycloak: {},
  },
  billing: {
    provider: 'stripe',
    stripe: {
      mode: 'test',
      secretKey: 'sk_test_staging',
      webhookSecret: 'whsec_staging',
      paidUnitPriceId: 'price_paid_staging',
      topupUnitPriceId: 'price_topup_staging',
      portalConfigurationId: 'bpc_staging',
    },
  },
  storage: {
    provider: 'r2',
    publicUrlPolicy: 'presigned',
    r2: {
      accountId: 'r2_account',
      bucketName: 'overlay-staging',
      accessKeyId: 'r2_access',
      secretAccessKey: 'r2_secret',
      endpointUrl: 'https://r2.example.com',
      globalBudgetBytes: 1000,
      presignTtlSeconds: 300,
    },
    s3: {},
  },
  llm: {
    gatewayProvider: 'openrouter',
    keySource: 'env',
    defaultChatModelId: 'openrouter/free',
    modelAllowlist: ['openrouter/free'],
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
  },
  database: {
    provider: 'convex',
    convexUrl: 'https://different-caiman-77.convex.cloud',
    deployment: 'dev:different-caiman-77',
    internalApiSecret: 'internal_staging',
    internalServiceAuthSecret: 'service_staging',
    apiKeyHashSecret: 'api_key_hash_staging',
  },
  capabilities: {
    billing: true,
    sso: true,
    apiKeys: true,
    webhooks: false,
    vectorSearch: true,
    automations: true,
    multiTenant: false,
  },
} satisfies OverlayRuntimeConfigInput

test('OverlayRuntimeConfigSchema validates minimal SaaS config', () => {
  const parsed = OverlayRuntimeConfigSchema.parse(minimalSaasConfig)
  assert.equal(parsed.auth.provider, 'workos')
  assert.equal(parsed.billing.provider, 'stripe')
  assert.equal(parsed.storage.provider, 'r2')
  assert.equal(parsed.capabilities.apiKeys, true)
})

test('OverlayRuntimeConfigSchema validates on-prem OIDC/S3/OpenAI config with billing disabled', () => {
  const parsed = OverlayRuntimeConfigSchema.parse({
    app: {
      baseUrl: 'https://overlay.internal.example.com',
      deploymentEnvironment: 'onprem',
      cspConnectSrc: ['https://minio.internal.example.com'],
      publicEnv: {},
    },
    auth: {
      provider: 'oidc',
      allowDevFallbacks: false,
      workos: {},
      oidc: {
        issuerUrl: 'https://idp.internal.example.com/realms/overlay',
        clientId: 'overlay-web',
        clientSecret: 'oidc_secret',
        audience: 'overlay',
      },
      keycloak: {},
    },
    billing: {
      provider: 'none',
      stripe: {},
    },
    storage: {
      provider: 's3',
      publicUrlPolicy: 'presigned',
      r2: {},
      s3: {
        bucketName: 'overlay',
        region: 'us-east-1',
        endpointUrl: 'https://minio.internal.example.com',
        accessKeyId: 'minio_access',
        secretAccessKey: 'minio_secret',
        forcePathStyle: true,
      },
    },
    llm: {
      gatewayProvider: 'openai',
      keySource: 'env',
      defaultChatModelId: 'gpt-4.1',
      modelAllowlist: ['gpt-4.1'],
      apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    database: {
      provider: 'convex',
      convexUrl: 'https://overlay-onprem.convex.cloud',
      deployment: 'dev:onprem-overlay',
      internalApiSecret: 'internal_onprem',
      internalServiceAuthSecret: 'service_onprem',
    },
    capabilities: {
      billing: false,
      sso: true,
      apiKeys: false,
      webhooks: false,
      vectorSearch: true,
      automations: true,
      multiTenant: false,
    },
  } satisfies OverlayRuntimeConfigInput)

  assert.equal(parsed.auth.provider, 'oidc')
  assert.equal(parsed.billing.provider, 'none')
  assert.equal(parsed.storage.provider, 's3')
  assert.equal(parsed.llm.gatewayProvider, 'openai')
})

test('OverlayRuntimeConfigSchema rejects mixed production and staging credentials', () => {
  assert.throws(
    () =>
      OverlayRuntimeConfigSchema.parse({
        ...minimalSaasConfig,
        database: {
          ...minimalSaasConfig.database,
          convexUrl: 'https://colorful-chickadee-419.convex.cloud',
          deployment: 'prod:colorful-chickadee-419',
        },
        auth: {
          ...minimalSaasConfig.auth,
          workos: {
            ...minimalSaasConfig.auth.workos,
            devClientId: 'client_dev',
            devApiKey: 'workos_dev_secret',
          },
        },
      }),
    /Production Convex must not be paired with DEV_WORKOS/,
  )

  assert.throws(
    () =>
      OverlayRuntimeConfigSchema.parse({
        ...minimalSaasConfig,
        app: {
          ...minimalSaasConfig.app,
          baseUrl: 'https://staging.getoverlay.io',
        },
        billing: {
          ...minimalSaasConfig.billing,
          stripe: {
            ...minimalSaasConfig.billing.stripe,
            mode: 'live',
            secretKey: 'sk_live_should_not_be_on_staging',
          },
        },
      }),
    /Stripe live keys must not be used with staging/,
  )
})

test('OverlayRuntimeConfigSchema requires API_KEY_HASH_SECRET when API keys are enabled', () => {
  assert.throws(
    () =>
      OverlayRuntimeConfigSchema.parse({
        ...minimalSaasConfig,
        database: {
          ...minimalSaasConfig.database,
          apiKeyHashSecret: undefined,
        },
      }),
    /API_KEY_HASH_SECRET/,
  )
})

test('OverlayRuntimeConfigSchema rejects secret-looking values in NEXT_PUBLIC fields', () => {
  assert.throws(
    () =>
      OverlayRuntimeConfigSchema.parse({
        ...minimalSaasConfig,
        app: {
          ...minimalSaasConfig.app,
          publicEnv: {
            NEXT_PUBLIC_APP_URL: 'https://staging.getoverlay.io',
            NEXT_PUBLIC_STRIPE_SECRET_KEY: 'sk_live_leaked',
          },
        },
      }),
    /must not be public/,
  )
})

test('redactOverlayRuntimeConfig never returns secret values', () => {
  const parsed = OverlayRuntimeConfigSchema.parse(minimalSaasConfig)
  const redacted = JSON.stringify(redactOverlayRuntimeConfig(parsed))

  assert.equal(redacted.includes('sk_test_staging'), false)
  assert.equal(redacted.includes('whsec_staging'), false)
  assert.equal(redacted.includes('internal_staging'), false)
  assert.equal(redacted.includes('api_key_hash_staging'), false)
  assert.equal(redacted.includes('workos_staging_secret'), false)
  assert.equal(redacted.includes('r2_secret'), false)
})
