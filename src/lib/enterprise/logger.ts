import { redactSecrets } from '@/lib/sentry-sanitize'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const SECRET_KEY_PATTERN = /(secret|token|password|api[_-]?key|authorization|cookie|private[_-]?key|license)/i

export function sanitizeForLog(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (typeof value === 'string') return redactSecrets(value)
  if (Array.isArray(value)) return value.map((item) => sanitizeForLog(item, seen))
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) return seen.get(value)

  const out: Record<string, unknown> = {}
  seen.set(value, out)
  for (const [key, entry] of Object.entries(value)) {
    out[key] = SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeForLog(entry, seen)
  }
  return out
}

export function logJson(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitizeForLog(fields) as Record<string, unknown>,
  }
  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export function createRequestId(): string {
  return crypto.randomUUID()
}
