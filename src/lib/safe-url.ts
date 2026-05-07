const SAFE_WEB_PROTOCOLS = new Set(['http:', 'https:'])

export function safeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    return SAFE_WEB_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null
  } catch {
    return null
  }
}

export function isSafeHttpUrl(raw: unknown): raw is string {
  return safeHttpUrl(raw) !== null
}

const SENSITIVE_QUERY_KEYS = [
  'access_token',
  'apikey',
  'api_key',
  'auth',
  'authorization',
  'code',
  'desktop_code_challenge',
  'id_token',
  'key',
  'refresh_token',
  'session_id',
  'state',
  'token',
]

function shouldRedactQueryKey(key: string): boolean {
  const normalized = key.trim().toLowerCase()
  return SENSITIVE_QUERY_KEYS.some((sensitive) => normalized === sensitive || normalized.includes(sensitive))
}

export function redactUrlForTelemetry(raw: string): string {
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://getoverlay.io')
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (shouldRedactQueryKey(key)) {
        parsed.searchParams.set(key, '[redacted]')
      }
    }
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return raw.split('?')[0]?.split('#')[0] ?? raw
  }
}

export function sameOriginPathUrl(baseUrl: string, candidate: unknown, fallbackPath = '/account'): string {
  const base = new URL(baseUrl)
  const raw = typeof candidate === 'string' && candidate.trim() ? candidate.trim() : fallbackPath
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return new URL(fallbackPath, base).toString()
  }
  const resolved = new URL(raw, base)
  if (resolved.origin !== base.origin) {
    return new URL(fallbackPath, base).toString()
  }
  return resolved.toString()
}
