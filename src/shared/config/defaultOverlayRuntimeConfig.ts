import type { OverlayRuntimeConfigInput } from './overlayConfigSchema'

export const DEFAULT_OVERLAY_RUNTIME_CONFIG = {
  app: {
    baseUrl: 'https://getoverlay.io',
    deploymentEnvironment: 'production',
    cspConnectSrc: [],
    publicEnv: {},
  },
  auth: {
    provider: 'workos',
    allowDevFallbacks: false,
    workos: {},
    oidc: {},
    keycloak: {},
  },
  billing: {
    provider: 'stripe',
    stripe: {
      mode: 'unknown',
    },
  },
  storage: {
    provider: 'r2',
    publicUrlPolicy: 'presigned',
    r2: {},
    s3: {},
  },
  llm: {
    gatewayProvider: 'openrouter',
    keySource: 'env',
    modelAllowlist: [],
  },
  database: {
    provider: 'convex',
  },
  capabilities: {
    billing: true,
    sso: true,
    apiKeys: false,
    webhooks: false,
    vectorSearch: true,
    automations: true,
    multiTenant: false,
  },
} satisfies OverlayRuntimeConfigInput
