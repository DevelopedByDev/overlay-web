const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{10,}\b/g,
  /\bpk_[A-Za-z0-9_-]{10,}\b/g,
  /\brk_[A-Za-z0-9_-]{10,}\b/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b[0-9a-f]{40,}\b/gi,
]

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
])

const SENSITIVE_QUERY_PARAMS = new Set([
  'access_token',
  'api_key',
  'apikey',
  'auth',
  'authorization',
  'code',
  'id_token',
  'key',
  'refresh_token',
  'token',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function redactSecrets(value: string): string {
  let result = value
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  return result
}

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value)
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        url.searchParams.set(key, '[REDACTED]')
      }
    }
    return redactSecrets(url.toString())
  } catch {
    return redactSecrets(value)
  }
}

function sanitizeUnknown(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (typeof value === 'string') {
    return redactSecrets(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeUnknown(entry, seen))
  }

  if (!isRecord(value)) {
    return value
  }

  if (seen.has(value)) {
    return seen.get(value)
  }

  const output: Record<string, unknown> = {}
  seen.set(value, output)

  for (const [key, entry] of Object.entries(value)) {
    output[key] = sanitizeUnknown(entry, seen)
  }

  return output
}

export function sanitizeSentryEvent<T>(event: T): T {
  const sanitized = sanitizeUnknown(event) as T

  if (!isRecord(sanitized)) {
    return sanitized
  }

  const request = isRecord(sanitized.request) ? sanitized.request : null
  if (request) {
    if (isRecord(request.headers)) {
      for (const headerName of Object.keys(request.headers)) {
        if (SENSITIVE_HEADERS.has(headerName.toLowerCase())) {
          delete request.headers[headerName]
        }
      }
    }

    if ('cookies' in request) {
      request.cookies = '[REDACTED]'
    }

    if (typeof request.url === 'string') {
      request.url = sanitizeUrl(request.url)
    }
  }

  return sanitized
}

export { redactSecrets }
