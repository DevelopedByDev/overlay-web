import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { getGatewayLanguageCatalog } from '@/server/ai/gateway/gateway-catalog'

export async function GET(request: NextRequest, _context: AppApiRouteContext) {
  const force = request.nextUrl.searchParams.get('refresh') === '1'
  const models = await getGatewayLanguageCatalog(force)
  return NextResponse.json({ models })
}
