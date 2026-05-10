// @enterprise-future — not wired to production
// Deep readiness probe. Checks each configured backend provider.
// Returns 503 if any critical provider is unreachable.

import { NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getSession } from '@/lib/workos-auth'

interface CheckResult {
  status: 'ok' | 'error'
  latencyMs?: number
  message?: string
}

export async function GET() {
  const checks: Record<string, CheckResult> = {}
  let overallStatus: 'ok' | 'degraded' = 'ok'

  // Database (Convex)
  try {
    const start = Date.now()
    await convex.query('health:ping', {})
    checks.database = { status: 'ok', latencyMs: Date.now() - start }
  } catch (err) {
    checks.database = {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    }
    overallStatus = 'degraded'
  }

  // Auth (WorkOS)
  const authStart = Date.now()
  try {
    await getSession()
    checks.auth = { status: 'ok', latencyMs: Date.now() - authStart }
  } catch (err) {
    // WorkOS session may be missing (no cookie); that's expected for unauthenticated calls
    if (err instanceof Error && err.message.includes('No session')) {
      checks.auth = { status: 'ok', latencyMs: Date.now() - authStart }
    } else {
      checks.auth = {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      }
      overallStatus = 'degraded'
    }
  }

  // AI gateway — check env vars present (lightweight, no live inference)
  if (process.env.AI_GATEWAY_URL) {
    checks.ai = { status: 'ok', message: 'AI_GATEWAY_URL configured' }
  } else {
    checks.ai = { status: 'ok', message: 'AI gateway not configured (optional)' }
  }

  // Storage — check env vars present
  if (process.env.R2_ENDPOINT || process.env.MINIO_ENDPOINT) {
    checks.storage = { status: 'ok', message: 'Storage configured' }
  } else {
    checks.storage = { status: 'ok', message: 'Storage not configured (optional)' }
  }

  // Billing — check env vars present
  if (process.env.STRIPE_SECRET_KEY) {
    checks.billing = { status: 'ok', message: 'Stripe configured' }
  } else {
    checks.billing = { status: 'ok', message: 'Billing not configured (optional)' }
  }

  const response = {
    status: overallStatus,
    timestamp: Date.now(),
    checks,
  }

  const statusCode = overallStatus === 'degraded' ? 503 : 200
  return NextResponse.json(response, { status: statusCode })
}
