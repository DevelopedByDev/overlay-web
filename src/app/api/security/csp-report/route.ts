import { NextRequest, NextResponse } from 'next/server'
import { logSecurityEvent } from '@/lib/security-events'
import { rateLimitByIp } from '@/lib/rate-limit'

import { z } from '@/lib/api-schemas'

const SecurityCspReportRequestSchema = z.object({ 'csp-report': z.record(z.unknown()).optional() }).passthrough().openapi('SecurityCspReportRequest')
const SecurityCspReportResponseSchema = z.unknown().openapi('SecurityCspReportResponse')
void SecurityCspReportRequestSchema
void SecurityCspReportResponseSchema

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitByIp(request, 'security:csp-report:ip', 30, 60_000)
    if (rateLimitResponse) return rateLimitResponse

    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return new NextResponse(null, { status: 204 })
    }
    const body = await request.json().catch(() => null)
    const report = body && typeof body === 'object' ? body as Record<string, unknown> : null
    logSecurityEvent(
      'csp_report',
      {
        userAgent: (request.headers.get('user-agent') || '').slice(0, 300) || undefined,
        origin: (request.headers.get('origin') || '').slice(0, 300) || undefined,
        blockedUri: String((report?.['csp-report'] as Record<string, unknown> | undefined)?.['blocked-uri'] ?? '').slice(0, 500) || undefined,
        violatedDirective: String((report?.['csp-report'] as Record<string, unknown> | undefined)?.['violated-directive'] ?? '').slice(0, 200) || undefined,
      },
      'warning',
    )
  } catch (error) {
    logSecurityEvent(
      'csp_report_parse_failed',
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'error',
    )
  }

  return new NextResponse(null, { status: 204 })
}
