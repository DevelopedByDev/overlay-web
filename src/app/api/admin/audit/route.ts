// @enterprise-future — not wired to production
// GET /api/admin/audit — recent audit events (admin-only)

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getRecentAuditEvents } from '@/lib/audit'

export async function GET(request: Request) {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const action = searchParams.get('action') || undefined
  const actorId = searchParams.get('actorId') || undefined

  const events = getRecentAuditEvents({ limit, action, actorId })
  return NextResponse.json({ events })
}
