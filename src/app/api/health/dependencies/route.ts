// @enterprise-future — not wired to production
// Deep readiness probe. Checks each configured backend provider.
// Returns 503 if any critical provider is unreachable.

import { NextResponse } from 'next/server'
import { createHandler } from '@/app/api/lib/middleware'
import { convex } from '@/lib/convex'
import { getSession } from '@/lib/workos-auth'

interface CheckResult {
  status: 'ok' | 'error'
  latencyMs?: number
  message?: string
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    const start = Date.now()
    await convex.query('health:ping', {})
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkAuth(): Promise<CheckResult> {
  const start = Date.now()
  try {
    await getSession()
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (err) {
    if (err instanceof Error && err.message.includes('No session')) {
      return { status: 'ok', latencyMs: Date.now() - start }
    }
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
