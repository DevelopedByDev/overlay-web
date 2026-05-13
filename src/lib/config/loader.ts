import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OverlayConfig, type OverlayConfigType } from './schema'
import { assertAirGapConfig } from '@/lib/enterprise/airgap'

type MutableRecord = Record<string, unknown>

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value == null) return undefined
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return undefined
}

function parseInteger(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : undefined
}

function parseCsv(value: string | undefined): string[] | undefined {
  if (!value?.trim()) return undefined
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function setNested(target: MutableRecord, path: string[], value: unknown) {
  if (value === undefined) return
  let cursor = target
  for (const segment of path.slice(0, -1)) {
    const existing = cursor[segment]
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as MutableRecord
  }
  cursor[path[path.length - 1]!] = value
}

function envOverrides(env: NodeJS.ProcessEnv): MutableRecord {
  const overrides: MutableRecord = {}
  setNested(overrides, ['deployment', 'mode'], env.OVERLAY_DEPLOYMENT_MODE)
  setNested(overrides, ['deployment', 'domain'], env.OVERLAY_DOMAIN || env.NEXT_PUBLIC_APP_URL)
  setNested(overrides, ['deployment', 'tls'], env.OVERLAY_TLS)
  setNested(overrides, ['deployment', 'trustProxyHeaders'], parseBoolean(env.TRUST_PROXY_HEADERS))
  setNested(overrides, ['providers', 'database'], env.OVERLAY_DATABASE_PROVIDER)
  setNested(overrides, ['providers', 'auth'], env.OVERLAY_AUTH_PROVIDER)
  setNested(overrides, ['providers', 'storage'], env.OVERLAY_STORAGE_PROVIDER)
  setNested(overrides, ['providers', 'aiGateway'], env.OVERLAY_AI_GATEWAY)
  setNested(overrides, ['providers', 'billing'], env.OVERLAY_BILLING_PROVIDER)
  setNested(overrides, ['providers', 'cache'], env.OVERLAY_CACHE_PROVIDER)
  setNested(overrides, ['providers', 'queue'], env.OVERLAY_QUEUE_PROVIDER)
  setNested(overrides, ['providers', 'search'], env.OVERLAY_SEARCH_PROVIDER)
  setNested(overrides, ['database', 'convex', 'url'], env.DEV_NEXT_PUBLIC_CONVEX_URL || env.NEXT_PUBLIC_CONVEX_URL)
  setNested(overrides, ['database', 'postgres', 'url'], env.DATABASE_URL || env.POSTGRES_URL)
  setNested(overrides, ['database', 'postgres', 'migrationMode'], env.OVERLAY_DB_MIGRATION_MODE)
  setNested(overrides, ['database', 'postgres', 'pool', 'max'], parseInteger(env.POSTGRES_POOL_MAX))
  setNested(overrides, ['auth', 'provider'], env.OVERLAY_AUTH_PROVIDER)
  setNested(overrides, ['auth', 'sessionTTLMinutes'], parseInteger(env.AUTH_SESSION_TTL_MINUTES))
  setNested(overrides, ['auth', 'mfaRequired'], parseBoolean(env.AUTH_MFA_REQUIRED))
  setNested(overrides, ['auth', 'allowedRedirectOrigins'], parseCsv(env.AUTH_ALLOWED_REDIRECT_ORIGINS))
  setNested(overrides, ['auth', 'oidc', 'issuer'], env.OIDC_ISSUER || env.KEYCLOAK_ISSUER)
  setNested(overrides, ['auth', 'oidc', 'clientId'], env.OIDC_CLIENT_ID || env.KEYCLOAK_CLIENT_ID)
  setNested(overrides, ['auth', 'oidc', 'clientSecret'], env.OIDC_CLIENT_SECRET || env.KEYCLOAK_CLIENT_SECRET)
  setNested(overrides, ['auth', 'oidc', 'scopes'], parseCsv(env.OIDC_SCOPES))
  setNested(overrides, ['auth', 'saml', 'metadataUrl'], env.SAML_METADATA_URL)
  setNested(overrides, ['auth', 'saml', 'metadataXml'], env.SAML_METADATA_XML)
  setNested(overrides, ['auth', 'saml', 'entryPoint'], env.SAML_ENTRY_POINT)
  setNested(overrides, ['auth', 'saml', 'issuer'], env.SAML_ISSUER)
  setNested(overrides, ['ai', 'gateway'], env.OVERLAY_AI_GATEWAY)
  setNested(overrides, ['ai', 'fallbackProvider'], env.OVERLAY_AI_FALLBACK_PROVIDER)
  setNested(overrides, ['ai', 'vercel', 'baseUrl'], env.AI_GATEWAY_URL)
  setNested(overrides, ['ai', 'vercel', 'apiKey'], env.AI_GATEWAY_API_KEY)
  setNested(overrides, ['ai', 'openrouter', 'baseUrl'], env.OPENROUTER_BASE_URL)
  setNested(overrides, ['ai', 'openrouter', 'apiKey'], env.OPENROUTER_API_KEY)
  setNested(overrides, ['ai', 'ollama', 'baseUrl'], env.OLLAMA_BASE_URL)
  setNested(overrides, ['ai', 'ollama', 'defaultModel'], env.OLLAMA_DEFAULT_MODEL)
  setNested(overrides, ['ai', 'ollama', 'imageEndpoint'], env.OLLAMA_IMAGE_ENDPOINT)
  setNested(overrides, ['ai', 'ollama', 'videoEndpoint'], env.OLLAMA_VIDEO_ENDPOINT)
  setNested(overrides, ['ai', 'vllm', 'baseUrl'], env.VLLM_BASE_URL)
  setNested(overrides, ['ai', 'vllm', 'defaultModel'], env.VLLM_DEFAULT_MODEL)
  setNested(overrides, ['ai', 'vllm', 'apiKey'], env.VLLM_API_KEY)
  setNested(overrides, ['ai', 'vllm', 'imageEndpoint'], env.VLLM_IMAGE_ENDPOINT)
  setNested(overrides, ['ai', 'vllm', 'videoEndpoint'], env.VLLM_VIDEO_ENDPOINT)
  setNested(overrides, ['ai', 'modelTiering', 'free'], parseCsv(env.OVERLAY_FREE_MODELS))
  setNested(overrides, ['ai', 'modelTiering', 'cheap'], parseCsv(env.OVERLAY_CHEAP_MODELS))
  setNested(overrides, ['ai', 'modelTiering', 'premium'], parseCsv(env.OVERLAY_PREMIUM_MODELS))
  setNested(overrides, ['billing', 'provider'], env.OVERLAY_BILLING_PROVIDER)
  setNested(overrides, ['billing', 'currency'], env.OVERLAY_BILLING_CURRENCY)
  setNested(overrides, ['billing', 'markupBasisPoints'], parseInteger(env.BILLING_MARKUP_BASIS_POINTS))
  setNested(overrides, ['storage', 'provider'], env.OVERLAY_STORAGE_PROVIDER)
  setNested(overrides, ['storage', 'publicUrlTtlSeconds'], parseInteger(env.STORAGE_PUBLIC_URL_TTL_SECONDS))
  setNested(overrides, ['storage', 'maxUploadSizeBytes'], parseInteger(env.STORAGE_MAX_UPLOAD_SIZE_BYTES))
  setNested(overrides, ['storage', 'r2', 'accountId'], env.R2_ACCOUNT_ID)
  setNested(overrides, ['storage', 'r2', 'bucket'], env.R2_BUCKET_NAME)
  setNested(overrides, ['storage', 'r2', 'endpoint'], env.S3_API || env.R2_ENDPOINT)
  setNested(overrides, ['storage', 'r2', 'accessKeyId'], env.R2_ACCESS_KEY_ID)
  setNested(overrides, ['storage', 'r2', 'secretAccessKey'], env.R2_SECRET_ACCESS_KEY)
  setNested(overrides, ['storage', 's3', 'bucket'], env.S3_BUCKET_NAME)
  setNested(overrides, ['storage', 's3', 'endpoint'], env.S3_ENDPOINT)
  setNested(overrides, ['storage', 's3', 'region'], env.S3_REGION)
  setNested(overrides, ['storage', 's3', 'accessKeyId'], env.S3_ACCESS_KEY_ID)
  setNested(overrides, ['storage', 's3', 'secretAccessKey'], env.S3_SECRET_ACCESS_KEY)
  setNested(overrides, ['storage', 's3', 'forcePathStyle'], parseBoolean(env.S3_FORCE_PATH_STYLE))
  setNested(overrides, ['storage', 'minio', 'bucket'], env.MINIO_BUCKET_NAME)
  setNested(overrides, ['storage', 'minio', 'endpoint'], env.MINIO_ENDPOINT)
  setNested(overrides, ['storage', 'minio', 'accessKeyId'], env.MINIO_ACCESS_KEY_ID || env.MINIO_ROOT_USER)
  setNested(overrides, ['storage', 'minio', 'secretAccessKey'], env.MINIO_SECRET_ACCESS_KEY || env.MINIO_ROOT_PASSWORD)
  setNested(overrides, ['storage', 'local', 'rootDir'], env.OVERLAY_STORAGE_DIR)
  setNested(overrides, ['cache', 'redis', 'url'], env.REDIS_URL)
  setNested(overrides, ['cache', 'valkey', 'url'], env.VALKEY_URL || env.REDIS_URL)
  setNested(overrides, ['rateLimit', 'auth', 'windowMs'], parseInteger(env.RATE_LIMIT_AUTH_WINDOW_MS))
  setNested(overrides, ['rateLimit', 'auth', 'maxRequests'], parseInteger(env.RATE_LIMIT_AUTH_MAX_REQUESTS))
  setNested(overrides, ['rateLimit', 'ai', 'windowMs'], parseInteger(env.RATE_LIMIT_AI_WINDOW_MS))
  setNested(overrides, ['rateLimit', 'ai', 'maxRequests'], parseInteger(env.RATE_LIMIT_AI_MAX_REQUESTS))
  setNested(overrides, ['rateLimit', 'storage', 'windowMs'], parseInteger(env.RATE_LIMIT_STORAGE_WINDOW_MS))
  setNested(overrides, ['rateLimit', 'storage', 'maxRequests'], parseInteger(env.RATE_LIMIT_STORAGE_MAX_REQUESTS))
  setNested(overrides, ['security', 'cspEnforce'], parseBoolean(env.SECURITY_CSP_ENFORCE))
  setNested(overrides, ['security', 'allowedFrameAncestors'], parseCsv(env.SECURITY_ALLOWED_FRAME_ANCESTORS))
  setNested(overrides, ['security', 'sessionCookie', 'secure'], parseBoolean(env.SESSION_COOKIE_SECURE))
  setNested(overrides, ['security', 'sessionCookie', 'sameSite'], env.SESSION_COOKIE_SAME_SITE)
  setNested(overrides, ['whiteLabel', 'appName'], env.OVERLAY_APP_NAME)
  setNested(overrides, ['whiteLabel', 'logoUrl'], env.OVERLAY_LOGO_URL)
  setNested(overrides, ['whiteLabel', 'faviconUrl'], env.OVERLAY_FAVICON_URL)
  setNested(overrides, ['whiteLabel', 'primaryColor'], env.OVERLAY_PRIMARY_COLOR)
  setNested(overrides, ['whiteLabel', 'accentColor'], env.OVERLAY_ACCENT_COLOR)
  setNested(overrides, ['whiteLabel', 'fontFamily'], env.OVERLAY_FONT_FAMILY)
  setNested(overrides, ['audit', 'retentionDays'], parseInteger(env.AUDIT_RETENTION_DAYS))
  setNested(overrides, ['audit', 'exportFormat'], env.AUDIT_EXPORT_FORMAT)
  setNested(overrides, ['enterprise', 'airGapped'], parseBoolean(env.OVERLAY_AIR_GAPPED))
  setNested(overrides, ['enterprise', 'externalEgressAllowlist'], parseCsv(env.OVERLAY_EXTERNAL_EGRESS_ALLOWLIST))
  setNested(overrides, ['enterprise', 'license', 'key'], env.OVERLAY_LICENSE_KEY)
  setNested(overrides, ['enterprise', 'license', 'file'], env.OVERLAY_LICENSE_FILE)
  setNested(overrides, ['enterprise', 'license', 'publicKey'], env.OVERLAY_LICENSE_PUBLIC_KEY)
  setNested(overrides, ['enterprise', 'license', 'gracePeriodDays'], parseInteger(env.OVERLAY_LICENSE_GRACE_PERIOD_DAYS))
  setNested(overrides, ['enterprise', 'smtp', 'host'], env.SMTP_HOST)
  setNested(overrides, ['enterprise', 'smtp', 'port'], parseInteger(env.SMTP_PORT))
  setNested(overrides, ['enterprise', 'smtp', 'secure'], parseBoolean(env.SMTP_SECURE))
  setNested(overrides, ['enterprise', 'smtp', 'username'], env.SMTP_USERNAME)
  setNested(overrides, ['enterprise', 'smtp', 'password'], env.SMTP_PASSWORD)
  setNested(overrides, ['enterprise', 'smtp', 'from'], env.SMTP_FROM)
  setNested(overrides, ['enterprise', 'smtp', 'heloName'], env.SMTP_HELO_NAME)
  if (env.OVERLAY_GROUP_ROLE_MAPPING?.trim()) {
    try {
      setNested(overrides, ['enterprise', 'groupRoleMapping'], JSON.parse(env.OVERLAY_GROUP_ROLE_MAPPING))
    } catch {
      // Let schema validation report malformed values if provided in config; env parse failures are ignored.
    }
  }
  return overrides
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base
  const result: MutableRecord = { ...(base as MutableRecord) }
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue
    const existing = result[key]
    result[key] =
      existing && typeof existing === 'object' && !Array.isArray(existing) &&
      value && typeof value === 'object' && !Array.isArray(value)
        ? deepMerge(existing, value)
        : value
  }
  return result as T
}

function normalizeProviderAliases(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const config = { ...(raw as MutableRecord) }
  const providers = {
    ...((config.providers && typeof config.providers === 'object' && !Array.isArray(config.providers))
      ? config.providers as MutableRecord
      : {}),
  }

  const sections: Array<[string, string]> = [
    ['auth', 'auth'],
    ['storage', 'storage'],
    ['billing', 'billing'],
  ]
  for (const [sectionName, providerName] of sections) {
    const section = config[sectionName]
    if (providers[providerName] === undefined && section && typeof section === 'object' && !Array.isArray(section)) {
      const provider = (section as MutableRecord).provider
      if (provider !== undefined) providers[providerName] = provider
    }
  }

  const ai = config.ai
  if (providers.aiGateway === undefined && ai && typeof ai === 'object' && !Array.isArray(ai)) {
    const gateway = (ai as MutableRecord).gateway
    if (gateway === 'vercel') providers.aiGateway = 'vercel-ai'
    else if (gateway !== undefined) providers.aiGateway = gateway
  }

  if (Object.keys(providers).length > 0) config.providers = providers
  return config
}

export function loadConfig(path = join(process.cwd(), 'overlay.config.json')): OverlayConfigType {
  const defaults = OverlayConfig.parse({})
  const fileConfig = existsSync(path)
    ? normalizeProviderAliases(JSON.parse(readFileSync(path, 'utf8')) as unknown)
    : {}
  const mergedFile = deepMerge(defaults, fileConfig)
  const config = OverlayConfig.parse(normalizeProviderAliases(deepMerge(mergedFile, envOverrides(process.env))))
  validateRuntimeConfig(config)
  return config
}

export function validateRuntimeConfig(config: OverlayConfigType): void {
  const databaseProvider = config.providers.database
  const authProvider = config.providers.auth === 'keycloak' ? 'oidc' : config.providers.auth

  if (config.deployment.mode === 'self-hosted' && databaseProvider === 'convex') {
    throw new Error('Self-hosted deployments must set OVERLAY_DATABASE_PROVIDER=postgres, sqlite, or memory.')
  }

  if (databaseProvider === 'postgres' && !config.database.postgres.url) {
    throw new Error('Postgres database provider requires DATABASE_URL or POSTGRES_URL.')
  }

  if (authProvider === 'oidc' && !config.auth.oidc.issuer) {
    throw new Error('OIDC/Keycloak auth requires OIDC_ISSUER or KEYCLOAK_ISSUER.')
  }

  if (
    authProvider === 'saml' &&
    !config.auth.saml.metadataUrl &&
    !config.auth.saml.metadataXml &&
    !config.auth.saml.entryPoint
  ) {
    throw new Error('SAML auth requires SAML_METADATA_URL, SAML_METADATA_XML, or SAML_ENTRY_POINT.')
  }

  assertAirGapConfig(config)
}
