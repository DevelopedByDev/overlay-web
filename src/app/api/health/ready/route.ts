import { NextResponse } from 'next/server'
import { getOverlayProviders } from '@/lib/provider-runtime'
import { recordProviderHealth } from '@/lib/enterprise/metrics'

export async function GET() {
  const health = await getOverlayProviders().registry.health()
  let status: 'ok' | 'degraded' = 'ok'
  for (const [domain, result] of Object.entries(health)) {
    recordProviderHealth({
      domain,
      providerId: result.providerId,
      status: result.status,
      latencyMs: result.latencyMs,
    })
    if (result.status !== 'ok') status = 'degraded'
  }

  return NextResponse.json(
    {
      status,
      kind: 'readiness',
      timestamp: Date.now(),
      checks: health,
    },
    { status: status === 'ok' ? 200 : 503 },
  )
}
