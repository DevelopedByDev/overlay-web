import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OverlayConfig, type OverlayConfigType } from './schema'

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
  setNested(overrides, ['auth', 'provider'], env.OVERLAY_AUTH_PROVIDER)
  setNested(overrides, ['auth', 'sessionTTLMinutes'], parseInteger(env.AUTH_SESSION_TTL_MINUTES))
  setNested(overrides, ['auth', 'mfaRequired'], parseBoolean(env.AUTH_MFA_REQUIRED))
  setNested(overrides, ['auth', 'allowedRedirectOrigins'], parseCsv(env.AUTH_ALLOWED_REDIRECT_ORIGINS))
  setNested(overrides, ['ai', 'gateway'], env.OVERLAY_AI_GATEWAY)
  setNested(overrides, ['ai', 'fallbackProvider'], env.OVERLAY_AI_FALLBACK_PROVIDER)
  setNested(overrides, ['ai', 'ollama', 'baseUrl'], env.OLLAMA_BASE_URL)
  setNested(overrides, ['ai', 'ollama', 'defaultModel'], env.OLLAMA_DEFAULT_MODEL)
  setNested(overrides, ['ai', 'vllm', 'baseUrl'], env.VLLM_BASE_URL)
  setNested(overrides, ['ai', 'vllm', 'defaultModel'], env.VLLM_DEFAULT_MODEL)
  setNested(overrides, ['ai', 'modelTiering', 'free'], parseCsv(env.OVERLAY_FREE_MODELS))
  setNested(overrides, ['ai', 'modelTiering', 'cheap'], parseCsv(env.OVERLAY_CHEAP_MODELS))
  setNested(overrides, ['ai', 'modelTiering', 'premium'], parseCsv(env.OVERLAY_PREMIUM_MODELS))
  setNested(overrides, ['billing', 'provider'], env.OVERLAY_BILLING_PROVIDER)
  setNested(overrides, ['billing', 'currency'], env.OVERLAY_BILLING_CURRENCY)
  setNested(overrides, ['billing', 'markupBasisPoints'], parseInteger(env.BILLING_MARKUP_BASIS_POINTS))
  setNested(overrides, ['storage', 'provider'], env.OVERLAY_STORAGE_PROVIDER)
  setNested(overrides, ['storage', 'publicUrlTtlSeconds'], parseInteger(env.STORAGE_PUBLIC_URL_TTL_SECONDS))
  setNested(overrides, ['storage', 'maxUploadSizeBytes'], parseInteger(env.STORAGE_MAX_UPLOAD_SIZE_BYTES))
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

export function loadConfig(path = join(process.cwd(), 'overlay.config.json')): OverlayConfigType {
  const defaults = OverlayConfig.parse({})
  const fileConfig = existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8')) as unknown
    : {}
  const mergedFile = deepMerge(defaults, fileConfig)
  return OverlayConfig.parse(deepMerge(mergedFile, envOverrides(process.env)))
}
