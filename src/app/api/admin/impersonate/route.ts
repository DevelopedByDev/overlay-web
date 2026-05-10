// @enterprise-future — not wired to production
// POST /api/admin/impersonate — stubbed (returns 501, logs audit event)

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { logAuditEvent } from '@/lib/audit'

export async function POST(request: Request) {
  const { isAdmin, userId } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // ignore parse error
  }

  if (userId) {
    logAuditEvent({
      actorId: userId,
      actorType: 'user',
      action: 'impersonate_attempt',
      resource: 'user',
      resourceId: typeof body.targetUserId === 'string' ? body.targetUserId : undefined,
      metadata: { reason: body.reason },
    })
  }

  return NextResponse.json(
    { error: 'Not implemented yet — coming in Phase 4' },
    { status: 501 },
  )
}
