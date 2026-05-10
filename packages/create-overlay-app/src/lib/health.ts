// @enterprise-future — not wired to production

export interface HealthResult {
  status: 'ok' | 'degraded' | 'down'
  checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; message?: string }>
}

export async function runHealthCheck(baseUrl: string, timeoutMs = 10000): Promise<HealthResult> {
  const deadline = Date.now() + timeoutMs
  const result: HealthResult = { status: 'ok', checks: {} }

  try {
    const start = Date.now()
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(timeoutMs) })
    const latency = Date.now() - start
    if (res.ok) {
      result.checks.liveness = { status: 'ok', latencyMs: latency }
    } else {
      result.checks.liveness = { status: 'error', latencyMs: latency, message: `HTTP ${res.status}` }
      result.status = 'down'
    }
  } catch (err) {
    result.checks.liveness = { status: 'error', message: err instanceof Error ? err.message : String(err) }
    result.status = 'down'
    return result
  }

  try {
    const remaining = deadline - Date.now()
    const start = Date.now()
    const res = await fetch(`${baseUrl}/api/health/dependencies`, {
      signal: AbortSignal.timeout(Math.max(remaining, 1000)),
    })
    const latency = Date.now() - start
    if (res.ok) {
      const body = (await res.json()) as HealthResult
      result.checks.dependencies = { status: 'ok', latencyMs: latency }
      for (const [key, check] of Object.entries(body.checks)) {
        result.checks[key] = check
        if (check.status !== 'ok') result.status = 'degraded'
      }
    } else {
      result.checks.dependencies = { status: 'error', latencyMs: latency, message: `HTTP ${res.status}` }
      result.status = 'degraded'
    }
  } catch (err) {
    result.checks.dependencies = { status: 'error', message: err instanceof Error ? err.message : String(err) }
    result.status = 'degraded'
  }

  return result
}
