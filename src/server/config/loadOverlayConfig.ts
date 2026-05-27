import 'server-only'

import { existsSync, readFileSync } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { ZodError } from 'zod'
import {
  inferStripeMode,
  mergeOverlayRuntimeConfig,
  parseOverlayRuntimeConfig,
  redactOverlayRuntimeConfig,
  type OverlayDeploymentEnvironment,
  type OverlayRuntimeConfig,
  type OverlayRuntimeConfigInput,
  type OverlayRuntimeConfigPublicSummary,
} from '../../shared/config'
import { overlayRuntimeConfigDefaults } from '../../overlay.config'

type EnvSource = Record<string, string | undefined>
type OverlayRuntimeConfigLayer = Record<string, unknown>

export interface LoadOverlayConfigOptions {
  env?: EnvSource
  cwd?: string
  defaultConfig?: OverlayRuntimeConfigInput
  configFilePath?: string | null
  remoteConfigUrl?: string | null
  fetcher?: typeof fetch
}

export class OverlayConfigError extends Error {
  readonly issues: string[]

  constructor(message: string, issues: string[]) {
    super(message)
    this.name = 'OverlayConfigError'
    this.issues = issues
  }
}

let cachedRuntimeConfig: OverlayRuntimeConfig | null = null

export async function loadOverlayConfig(
  options: LoadOverlayConfigOptions = {},
): Promise<OverlayRuntimeConfig> {
  const env = options.env ?? process.env
  const defaultConfig = options.defaultConfig ?? overlayRuntimeConfigDefaults
  const fileConfig = await readJsonConfigFile(resolveConfigFilePath(options, env), options.cwd)
  const remoteConfig = await readRemoteConfig(resolveRemoteConfigUrl(options, env), options.fetcher)
  const envConfig = configOverridesFromEnv(env)

  return parseConfigOrThrow(
    mergeOverlayRuntimeConfig(defaultConfig, fileConfig, remoteConfig, envConfig),
  )
}

export function loadOverlayConfigSync(
  options: Omit<LoadOverlayConfigOptions, 'fetcher' | 'remoteConfigUrl'> = {},
): OverlayRuntimeConfig {
  const env = options.env ?? process.env
  const defaultConfig = options.defaultConfig ?? overlayRuntimeConfigDefaults
  const remoteUrl = readEnv(env, 'OVERLAY_CONFIG_URL')
  if (remoteUrl) {
    throw new OverlayConfigError('Remote runtime config requires async loadOverlayConfig()', [
      'OVERLAY_CONFIG_URL is set but loadOverlayConfigSync() cannot fetch remote config.',
    ])
  }

  const fileConfig = readJsonConfigFileSync(resolveConfigFilePath(options, env), options.cwd)
  const envConfig = configOverridesFromEnv(env)
  return parseConfigOrThrow(mergeOverlayRuntimeConfig(defaultConfig, fileConfig, envConfig))
}

export async function getOverlayRuntimeConfig(): Promise<OverlayRuntimeConfig> {
  cachedRuntimeConfig ??= await loadOverlayConfig()
  return cachedRuntimeConfig
}

export function getOverlayRuntimeConfigSync(): OverlayRuntimeConfig {
  cachedRuntimeConfig ??= loadOverlayConfigSync()
  return cachedRuntimeConfig
}

export function clearOverlayRuntimeConfigCache(): void {
  cachedRuntimeConfig = null
}

export function getRedactedOverlayRuntimeConfigSummary(
  config: OverlayRuntimeConfig,
): OverlayRuntimeConfigPublicSummary {
  return redactOverlayRuntimeConfig(config)
}

export function formatOverlayConfigError(error: unknown): { message: string; issues: string[] } {
  if (error instanceof OverlayConfigError) {
    return { message: error.message, issues: error.issues }
  }
  if (error instanceof ZodError) {
    return {
      message: 'Overlay runtime configuration is invalid',
      issues: error.issues.map((issue) => {
        const pathLabel = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
        return `${pathLabel}${issue.message}`
      }),
    }
  }
  if (error instanceof Error) {
    return { message: error.message, issues: [error.message] }
  }
  return { message: 'Overlay runtime configuration is invalid', issues: [String(error)] }
}

function parseConfigOrThrow(value: unknown): OverlayRuntimeConfig {
  try {
    return parseOverlayRuntimeConfig(value)
  } catch (error) {
    const formatted = formatOverlayConfigError(error)
    throw new OverlayConfigError(formatted.message, formatted.issues)
  }
}

function resolveConfigFilePath(
  options: Pick<LoadOverlayConfigOptions, 'configFilePath'>,
  env: EnvSource,
): string | null {
  if (options.configFilePath !== undefined) return options.configFilePath
  return readEnv(env, 'OVERLAY_CONFIG_FILE') ?? 'overlay.config.json'
}

function resolveRemoteConfigUrl(
  options: Pick<LoadOverlayConfigOptions, 'remoteConfigUrl'>,
  env: EnvSource,
): string | null {
  if (options.remoteConfigUrl !== undefined) return options.remoteConfigUrl
  return readEnv(env, 'OVERLAY_CONFIG_URL') ?? null
}

async function readJsonConfigFile(
  filePath: string | null,
  cwd = process.cwd(),
): Promise<OverlayRuntimeConfigLayer> {
  if (!filePath) return {}
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath)
  try {
    await access(absolutePath)
  } catch {
    if (filePath === 'overlay.config.json') return {}
    throw new OverlayConfigError('Overlay config file not found', [`Missing ${absolutePath}`])
  }

  return parseJsonObject(await readFile(absolutePath, 'utf8'), absolutePath)
}

function readJsonConfigFileSync(
  filePath: string | null,
  cwd = process.cwd(),
): OverlayRuntimeConfigLayer {
  if (!filePath) return {}
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath)
  if (!existsSync(absolutePath)) {
    if (filePath === 'overlay.config.json') return {}
    throw new OverlayConfigError('Overlay config file not found', [`Missing ${absolutePath}`])
  }

  return parseJsonObject(readFileSync(absolutePath, 'utf8'), absolutePath)
}

async function readRemoteConfig(
  remoteConfigUrl: string | null,
  fetcher: typeof fetch = fetch,
): Promise<OverlayRuntimeConfigLayer> {
  if (!remoteConfigUrl) return {}
  const response = await fetcher(remoteConfigUrl, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new OverlayConfigError('Remote overlay config fetch failed', [
      `${remoteConfigUrl} returned HTTP ${response.status}`,
    ])
  }
  const json = await response.json()
  return assertPlainConfigObject(json, remoteConfigUrl)
}

function parseJsonObject(raw: string, source: string): OverlayRuntimeConfigLayer {
  try {
    return assertPlainConfigObject(JSON.parse(raw), source)
  } catch (error) {
    if (error instanceof OverlayConfigError) throw error
    throw new OverlayConfigError('Overlay config JSON is invalid', [
      `${source}: ${error instanceof Error ? error.message : String(error)}`,
    ])
  }
}

function assertPlainConfigObject(
  value: unknown,
  source: string,
): OverlayRuntimeConfigLayer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OverlayConfigError('Overlay config must be a JSON object', [source])
  }
  return value as OverlayRuntimeConfigLayer
}

export function configOverridesFromEnv(env: EnvSource): OverlayRuntimeConfigLayer {
  const deploymentEnvironment = resolveDeploymentEnvironment(env)
  const appBaseUrl = resolveAppBaseUrl(env)
  const publicEnv = collectPublicEnv(env)
  const auth = authConfigFromEnv(env, deploymentEnvironment)
  const billing = billingConfigFromEnv(env, deploymentEnvironment)
  const storage = storageConfigFromEnv(env)
  const llm = llmConfigFromEnv(env)
  const database = databaseConfigFromEnv(env, deploymentEnvironment)
  const capabilities = capabilitiesFromEnv(env)

  const config: OverlayRuntimeConfigLayer = {}
  if (appBaseUrl || deploymentEnvironment || Object.keys(publicEnv).length > 0 || readEnv(env, 'OVERLAY_CSP_CONNECT_SRC')) {
    config.app = {
      ...(appBaseUrl ? { baseUrl: appBaseUrl } : {}),
      ...(deploymentEnvironment ? { deploymentEnvironment } : {}),
      ...(readEnv(env, 'OVERLAY_CSP_CONNECT_SRC')
        ? { cspConnectSrc: splitCsv(readEnv(env, 'OVERLAY_CSP_CONNECT_SRC')) }
        : {}),
      ...(Object.keys(publicEnv).length > 0 ? { publicEnv } : {}),
    }
  }
  if (auth) config.auth = auth
  if (billing) config.billing = billing
  if (storage) config.storage = storage
  if (llm) config.llm = llm
  if (database) config.database = database
  if (Object.keys(capabilities).length > 0) config.capabilities = capabilities
  return config
}

function authConfigFromEnv(
  env: EnvSource,
  deploymentEnvironment?: OverlayDeploymentEnvironment,
): OverlayRuntimeConfigLayer | null {
  const workosClientId = readEnv(env, 'WORKOS_CLIENT_ID')
  const workosApiKey = readEnv(env, 'WORKOS_API_KEY')
  const devWorkosClientId = readEnv(env, 'DEV_WORKOS_CLIENT_ID')
  const devWorkosApiKey = readEnv(env, 'DEV_WORKOS_API_KEY')
  const oidcIssuerUrl = readEnv(env, 'OIDC_ISSUER_URL') ?? readEnv(env, 'KEYCLOAK_ISSUER_URL')
  const oidcClientId = readEnv(env, 'OIDC_CLIENT_ID') ?? readEnv(env, 'KEYCLOAK_CLIENT_ID')
  const provider =
    readEnv(env, 'AUTH_PROVIDER') ??
    (workosClientId || workosApiKey || devWorkosClientId || devWorkosApiKey
      ? 'workos'
      : oidcIssuerUrl || oidcClientId
        ? 'oidc'
        : undefined)

  const allowDevFallbacks =
    readBool(env, 'ALLOW_DEV_AUTH_FALLBACKS') ??
    (deploymentEnvironment === 'development' || deploymentEnvironment === 'test')

  if (
    !provider &&
    !workosClientId &&
    !workosApiKey &&
    !devWorkosClientId &&
    !devWorkosApiKey &&
    !oidcIssuerUrl &&
    !oidcClientId
  ) {
    return null
  }

  return {
    ...(provider ? { provider: provider as OverlayRuntimeConfigInput['auth']['provider'] } : {}),
    allowDevFallbacks,
    workos: {
      ...(workosClientId ? { clientId: workosClientId } : {}),
      ...(workosApiKey ? { apiKey: workosApiKey } : {}),
      ...(devWorkosClientId ? { devClientId: devWorkosClientId } : {}),
      ...(devWorkosApiKey ? { devApiKey: devWorkosApiKey } : {}),
      ...(readEnv(env, 'WORKOS_JWKS_BASE_URL') ? { jwksBaseUrl: readEnv(env, 'WORKOS_JWKS_BASE_URL') } : {}),
    },
    oidc: {
      ...(oidcIssuerUrl ? { issuerUrl: oidcIssuerUrl } : {}),
      ...(oidcClientId ? { clientId: oidcClientId } : {}),
      ...(readEnv(env, 'OIDC_CLIENT_SECRET') ? { clientSecret: readEnv(env, 'OIDC_CLIENT_SECRET') } : {}),
      ...(readEnv(env, 'OIDC_AUDIENCE') ? { audience: readEnv(env, 'OIDC_AUDIENCE') } : {}),
    },
    keycloak: {
      ...(readEnv(env, 'KEYCLOAK_ISSUER_URL') ? { issuerUrl: readEnv(env, 'KEYCLOAK_ISSUER_URL') } : {}),
      ...(readEnv(env, 'KEYCLOAK_CLIENT_ID') ? { clientId: readEnv(env, 'KEYCLOAK_CLIENT_ID') } : {}),
      ...(readEnv(env, 'KEYCLOAK_CLIENT_SECRET') ? { clientSecret: readEnv(env, 'KEYCLOAK_CLIENT_SECRET') } : {}),
      ...(readEnv(env, 'KEYCLOAK_REALM') ? { realm: readEnv(env, 'KEYCLOAK_REALM') } : {}),
    },
  }
}

function billingConfigFromEnv(
  env: EnvSource,
  deploymentEnvironment?: OverlayDeploymentEnvironment,
): OverlayRuntimeConfigLayer | null {
  const secretKey =
    deploymentEnvironment === 'production'
      ? readEnv(env, 'STRIPE_SECRET_KEY')
      : readEnv(env, 'DEV_STRIPE_SECRET_KEY') ?? readEnv(env, 'STRIPE_SECRET_KEY')
  const webhookSecret =
    deploymentEnvironment === 'production'
      ? readEnv(env, 'STRIPE_WEBHOOK_SECRET')
      : readEnv(env, 'DEV_STRIPE_WEBHOOK_SECRET') ?? readEnv(env, 'STRIPE_WEBHOOK_SECRET')
  const provider = readEnv(env, 'BILLING_PROVIDER') ?? (secretKey ? 'stripe' : undefined)

  if (!provider && !secretKey && !webhookSecret) return null

  return {
    ...(provider ? { provider: provider as OverlayRuntimeConfigInput['billing']['provider'] } : {}),
    stripe: {
      mode: inferStripeMode(secretKey),
      ...(secretKey ? { secretKey } : {}),
      ...(webhookSecret ? { webhookSecret } : {}),
      ...(resolveStripePriceEnv(env, deploymentEnvironment, 'STRIPE_PAID_UNIT_PRICE_ID', 'DEV_STRIPE_PAID_UNIT_PRICE_ID')
        ? {
            paidUnitPriceId: resolveStripePriceEnv(
              env,
              deploymentEnvironment,
              'STRIPE_PAID_UNIT_PRICE_ID',
              'DEV_STRIPE_PAID_UNIT_PRICE_ID',
            ),
          }
        : {}),
      ...(resolveStripePriceEnv(env, deploymentEnvironment, 'STRIPE_TOPUP_UNIT_PRICE_ID', 'DEV_STRIPE_TOPUP_UNIT_PRICE_ID')
        ? {
            topupUnitPriceId: resolveStripePriceEnv(
              env,
              deploymentEnvironment,
              'STRIPE_TOPUP_UNIT_PRICE_ID',
              'DEV_STRIPE_TOPUP_UNIT_PRICE_ID',
            ),
          }
        : {}),
      ...(resolveStripePriceEnv(env, deploymentEnvironment, 'STRIPE_PORTAL_CONFIGURATION_ID', 'DEV_STRIPE_PORTAL_CONFIGURATION_ID')
        ? {
            portalConfigurationId: resolveStripePriceEnv(
              env,
              deploymentEnvironment,
              'STRIPE_PORTAL_CONFIGURATION_ID',
              'DEV_STRIPE_PORTAL_CONFIGURATION_ID',
            ),
          }
        : {}),
    },
  }
}

function storageConfigFromEnv(env: EnvSource): OverlayRuntimeConfigLayer | null {
  const provider =
    readEnv(env, 'STORAGE_PROVIDER') ??
    (readEnv(env, 'R2_BUCKET_NAME') || readEnv(env, 'R2_ACCOUNT_ID') ? 'r2' : undefined)
  if (!provider && !readEnv(env, 'R2_BUCKET_NAME')) return null

  return {
    ...(provider ? { provider: provider as OverlayRuntimeConfigInput['storage']['provider'] } : {}),
    ...(readEnv(env, 'STORAGE_PUBLIC_URL_POLICY')
      ? {
          publicUrlPolicy: readEnv(env, 'STORAGE_PUBLIC_URL_POLICY') as OverlayRuntimeConfigInput['storage']['publicUrlPolicy'],
        }
      : {}),
    r2: {
      ...(readEnv(env, 'R2_ACCOUNT_ID') ? { accountId: readEnv(env, 'R2_ACCOUNT_ID') } : {}),
      ...(readEnv(env, 'R2_BUCKET_NAME') ? { bucketName: readEnv(env, 'R2_BUCKET_NAME') } : {}),
      ...(readEnv(env, 'R2_ACCESS_KEY_ID') ? { accessKeyId: readEnv(env, 'R2_ACCESS_KEY_ID') } : {}),
      ...(readEnv(env, 'R2_SECRET_ACCESS_KEY') ? { secretAccessKey: readEnv(env, 'R2_SECRET_ACCESS_KEY') } : {}),
      ...(readEnv(env, 'S3_API') ? { endpointUrl: readEnv(env, 'S3_API') } : {}),
      ...(readNumber(env, 'R2_GLOBAL_BUDGET_BYTES') ? { globalBudgetBytes: readNumber(env, 'R2_GLOBAL_BUDGET_BYTES') } : {}),
      ...(readNumber(env, 'R2_PRESIGN_TTL_SECONDS') ? { presignTtlSeconds: readNumber(env, 'R2_PRESIGN_TTL_SECONDS') } : {}),
    },
    s3: {
      ...(readEnv(env, 'S3_BUCKET_NAME') ? { bucketName: readEnv(env, 'S3_BUCKET_NAME') } : {}),
      ...(readEnv(env, 'S3_REGION') ? { region: readEnv(env, 'S3_REGION') } : {}),
      ...(readEnv(env, 'S3_ENDPOINT_URL') ? { endpointUrl: readEnv(env, 'S3_ENDPOINT_URL') } : {}),
      ...(readEnv(env, 'S3_ACCESS_KEY_ID') ? { accessKeyId: readEnv(env, 'S3_ACCESS_KEY_ID') } : {}),
      ...(readEnv(env, 'S3_SECRET_ACCESS_KEY') ? { secretAccessKey: readEnv(env, 'S3_SECRET_ACCESS_KEY') } : {}),
      ...(readBool(env, 'S3_FORCE_PATH_STYLE') !== undefined ? { forcePathStyle: readBool(env, 'S3_FORCE_PATH_STYLE') } : {}),
    },
  }
}

function llmConfigFromEnv(env: EnvSource): OverlayRuntimeConfigLayer | null {
  const gatewayProvider =
    readEnv(env, 'LLM_GATEWAY') ??
    (readEnv(env, 'AI_GATEWAY_API_KEY')
      ? 'ai-gateway'
      : readEnv(env, 'OPENROUTER_API_KEY')
        ? 'openrouter'
        : readEnv(env, 'OPENAI_API_KEY')
          ? 'openai'
          : undefined)
  if (!gatewayProvider && !readEnv(env, 'DEFAULT_CHAT_MODEL_ID') && !readEnv(env, 'LLM_MODEL_ALLOWLIST')) {
    return null
  }

  return {
    ...(gatewayProvider
      ? { gatewayProvider: gatewayProvider as OverlayRuntimeConfigInput['llm']['gatewayProvider'] }
      : {}),
    ...(readEnv(env, 'LLM_KEY_SOURCE')
      ? { keySource: readEnv(env, 'LLM_KEY_SOURCE') as OverlayRuntimeConfigInput['llm']['keySource'] }
      : {}),
    ...(readEnv(env, 'DEFAULT_CHAT_MODEL_ID') ? { defaultChatModelId: readEnv(env, 'DEFAULT_CHAT_MODEL_ID') } : {}),
    ...(readEnv(env, 'LLM_MODEL_ALLOWLIST') ? { modelAllowlist: splitCsv(readEnv(env, 'LLM_MODEL_ALLOWLIST')) } : {}),
    ...(readEnv(env, 'LLM_API_KEY_ENV_VAR') ? { apiKeyEnvVar: readEnv(env, 'LLM_API_KEY_ENV_VAR') } : {}),
  }
}

function databaseConfigFromEnv(
  env: EnvSource,
  deploymentEnvironment?: OverlayDeploymentEnvironment,
): OverlayRuntimeConfigLayer | null {
  const convexUrl =
    deploymentEnvironment === 'development'
      ? readEnv(env, 'DEV_NEXT_PUBLIC_CONVEX_URL') ?? readEnv(env, 'NEXT_PUBLIC_CONVEX_URL')
      : readEnv(env, 'NEXT_PUBLIC_CONVEX_URL') ?? readEnv(env, 'DEV_NEXT_PUBLIC_CONVEX_URL')

  if (
    !convexUrl &&
    !readEnv(env, 'CONVEX_DEPLOYMENT') &&
    !readEnv(env, 'INTERNAL_API_SECRET') &&
    !readEnv(env, 'INTERNAL_SERVICE_AUTH_SECRET') &&
    !readEnv(env, 'API_KEY_HASH_SECRET')
  ) {
    return null
  }

  return {
    provider: 'convex',
    ...(convexUrl ? { convexUrl } : {}),
    ...(readEnv(env, 'CONVEX_DEPLOYMENT') ? { deployment: readEnv(env, 'CONVEX_DEPLOYMENT') } : {}),
    ...(readEnv(env, 'INTERNAL_API_SECRET') ? { internalApiSecret: readEnv(env, 'INTERNAL_API_SECRET') } : {}),
    ...(readEnv(env, 'INTERNAL_SERVICE_AUTH_SECRET')
      ? { internalServiceAuthSecret: readEnv(env, 'INTERNAL_SERVICE_AUTH_SECRET') }
      : {}),
    ...(readEnv(env, 'API_KEY_HASH_SECRET') ? { apiKeyHashSecret: readEnv(env, 'API_KEY_HASH_SECRET') } : {}),
  }
}

function capabilitiesFromEnv(env: EnvSource): OverlayRuntimeConfigLayer {
  return {
    ...(readBool(env, 'OVERLAY_CAPABILITY_BILLING') !== undefined
      ? { billing: readBool(env, 'OVERLAY_CAPABILITY_BILLING') }
      : readBool(env, 'BILLING_ENABLED') !== undefined
        ? { billing: readBool(env, 'BILLING_ENABLED') }
        : {}),
    ...(readBool(env, 'OVERLAY_CAPABILITY_SSO') !== undefined ? { sso: readBool(env, 'OVERLAY_CAPABILITY_SSO') } : {}),
    ...(readBool(env, 'API_KEYS_ENABLED') !== undefined ? { apiKeys: readBool(env, 'API_KEYS_ENABLED') } : {}),
    ...(readBool(env, 'WEBHOOKS_ENABLED') !== undefined ? { webhooks: readBool(env, 'WEBHOOKS_ENABLED') } : {}),
    ...(readBool(env, 'VECTOR_SEARCH_ENABLED') !== undefined ? { vectorSearch: readBool(env, 'VECTOR_SEARCH_ENABLED') } : {}),
    ...(readBool(env, 'AUTOMATIONS_ENABLED') !== undefined ? { automations: readBool(env, 'AUTOMATIONS_ENABLED') } : {}),
    ...(readBool(env, 'MULTI_TENANT_ENABLED') !== undefined ? { multiTenant: readBool(env, 'MULTI_TENANT_ENABLED') } : {}),
  }
}

function resolveAppBaseUrl(env: EnvSource): string | undefined {
  const configured = readEnv(env, 'NEXT_PUBLIC_APP_URL') ?? readEnv(env, 'DEV_NEXT_PUBLIC_APP_URL')
  if (configured) return configured

  const vercelUrl = readEnv(env, 'VERCEL_URL')
  return vercelUrl ? `https://${vercelUrl}` : undefined
}

function resolveDeploymentEnvironment(env: EnvSource): OverlayDeploymentEnvironment | undefined {
  const explicit = readEnv(env, 'OVERLAY_DEPLOYMENT_ENV')
  if (isDeploymentEnvironment(explicit)) return explicit

  const appUrl = resolveAppBaseUrl(env)
  if (appUrl && /staging|preview|vercel\.app/i.test(appUrl)) return 'staging'

  const vercelEnv = readEnv(env, 'VERCEL_ENV')
  if (vercelEnv === 'production') return 'production'
  if (vercelEnv === 'preview') return 'preview'
  if (vercelEnv === 'development') return 'development'

  const nodeEnv = readEnv(env, 'NODE_ENV')
  if (nodeEnv === 'test') return 'test'
  if (nodeEnv === 'development') return 'development'
  if (nodeEnv === 'production') return 'production'
  return undefined
}

function isDeploymentEnvironment(value: string | undefined): value is OverlayDeploymentEnvironment {
  return Boolean(
    value &&
      ['development', 'test', 'preview', 'staging', 'production', 'onprem'].includes(value),
  )
}

function resolveStripePriceEnv(
  env: EnvSource,
  deploymentEnvironment: OverlayDeploymentEnvironment | undefined,
  primary: string,
  dev: string,
): string | undefined {
  return deploymentEnvironment === 'production'
    ? readEnv(env, primary)
    : readEnv(env, dev) ?? readEnv(env, primary)
}

function collectPublicEnv(env: EnvSource): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(env)) {
    const value = rawValue?.trim()
    if (key.startsWith('NEXT_PUBLIC_') && value) {
      out[key] = value
    }
  }
  return out
}

function readEnv(env: EnvSource, name: string): string | undefined {
  const value = env[name]?.trim()
  return value ? value : undefined
}

function readBool(env: EnvSource, name: string): boolean | undefined {
  const value = readEnv(env, name)?.toLowerCase()
  if (value === undefined) return undefined
  if (['1', 'true', 'yes', 'on'].includes(value)) return true
  if (['0', 'false', 'no', 'off'].includes(value)) return false
  return undefined
}

function readNumber(env: EnvSource, name: string): number | undefined {
  const value = readEnv(env, name)
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
