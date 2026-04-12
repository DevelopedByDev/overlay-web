import { NextRequest, NextResponse } from 'next/server'
import { logSecurityEvent } from '@/lib/security-events'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    logSecurityEvent(
      'csp_report',
      {
        userAgent: request.headers.get('user-agent') || undefined,
        origin: request.headers.get('origin') || undefined,
        body,
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
