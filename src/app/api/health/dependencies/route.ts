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
import { recordProviderHealth } from '@/lib/enterprise/metrics'

interface CheckResult {
  status: 'ok' | 'error'
  latencyMs?: number
  message?: string
}

export const GET = createHandler(
  {},
  async () => {
    const checks: Record<string, CheckResult> = {}
    let overallStatus: 'ok' | 'degraded' = 'ok'

    const health = await getOverlayProviders().registry.health()
    for (const [domain, result] of Object.entries(health)) {
      recordProviderHealth({
        domain,
        providerId: result.providerId,
        status: result.status,
        latencyMs: result.latencyMs,
      })
      checks[domain] = {
        status: result.status === 'ok' ? 'ok' : 'error',
        latencyMs: result.latencyMs,
        message: result.message || `${result.providerId} ${result.status}`,
      }
      if (result.status !== 'ok') overallStatus = 'degraded'
    }

    const statusCode = overallStatus === 'degraded' ? 503 : 200
    return NextResponse.json(
      { status: overallStatus, timestamp: Date.now(), checks },
      { status: statusCode },
    )
  },
)
