import { z } from '@/lib/api-schemas'

const HealthDependenciesRequestSchema = z.object({}).openapi('HealthDependenciesRequest')
const HealthDependenciesResponseSchema = z.unknown().openapi('HealthDependenciesResponse')
void HealthDependenciesRequestSchema
void HealthDependenciesResponseSchema

// @enterprise-future — not wired to production
// Deep readiness probe. Checks each configured backend provider.
// Returns 503 if any critical provider is unreachable.

import { NextResponse } from 'next/server'
import { createHandler } from '@/app/api/lib/middleware'
import { getOverlayProviders } from '@/lib/provider-runtime'

interface CheckResult {
  status: 'ok' | 'error'
  latencyMs?: number
  message?: string
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    const start = Date.now()
    const result = await getOverlayProviders().database.health()
    return {
      status: result.ok ? 'ok' : 'error',
      latencyMs: result.latencyMs ?? Date.now() - start,
      message: result.message,
    }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkAuth(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const result = await getOverlayProviders().auth.health?.()
    return {
      status: result?.ok === false ? 'error' : 'ok',
      latencyMs: result?.latencyMs ?? Date.now() - start,
      message: result?.message,
    }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

function checkEnvVar(name: string, label: string): CheckResult {
  return process.env[name]
    ? { status: 'ok', message: `${label} configured` }
    : { status: 'ok', message: `${label} not configured (optional)` }
}

export const GET = createHandler(
  {},
  async () => {
    const checks: Record<string, CheckResult> = {}
    let overallStatus: 'ok' | 'degraded' = 'ok'

    const database = await checkDatabase()
    checks.database = database
    if (database.status === 'error') overallStatus = 'degraded'

    const auth = await checkAuth()
    checks.auth = auth
    if (auth.status === 'error') overallStatus = 'degraded'

    checks.ai = checkEnvVar('AI_GATEWAY_URL', 'AI gateway')
    checks.storage = checkEnvVar('R2_ENDPOINT', 'Storage')
    checks.billing = checkEnvVar('STRIPE_SECRET_KEY', 'Billing')

    const statusCode = overallStatus === 'degraded' ? 503 : 200
    return NextResponse.json(
      { status: overallStatus, timestamp: Date.now(), checks },
      { status: statusCode },
    )
  },
)
