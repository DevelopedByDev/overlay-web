import { NextResponse } from 'next/server'
import { getOverlayProviders } from '@/lib/provider-runtime'
import { getMetricsText, recordProviderHealth, setGaugeMetric } from '@/lib/enterprise/metrics'
import { getLicenseState } from '@/lib/enterprise/license'
import { getConfig } from '@/lib/config/singleton'

export async function GET() {
  const providers = getOverlayProviders()
  const health = await providers.registry.health()
  for (const [domain, result] of Object.entries(health)) {
    recordProviderHealth({
      domain,
      providerId: result.providerId,
      status: result.status,
      latencyMs: result.latencyMs,
    })
  }

  const license = getLicenseState()
  setGaugeMetric('overlay_license_valid', 'License validity, 1 when valid', undefined, license.status === 'valid' ? 1 : 0)
  setGaugeMetric('overlay_air_gapped_mode', 'Air-gapped mode enabled, 1 when enabled', undefined, getConfig().enterprise.airGapped ? 1 : 0)

  return new NextResponse(getMetricsText(), {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
