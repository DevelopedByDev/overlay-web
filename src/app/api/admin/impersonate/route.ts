// @enterprise-future — not wired to production
// POST /api/admin/impersonate — stubbed (returns 501, logs audit event)

import { NextResponse } from 'next/server'
import { createHandler, withRequireAuth, withAdmin, auditLog } from '@/app/api/lib/middleware'

export const POST = createHandler(
  { middleware: [withRequireAuth, withAdmin] },
  async (request, ctx) => {
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      // ignore parse error
    }

    auditLog(ctx, {
      action: 'impersonate_attempt',
      resource: 'user',
      resourceId: typeof body.targetUserId === 'string' ? body.targetUserId : undefined,
      metadata: { reason: body.reason },
    })

    return NextResponse.json(
      { error: 'Not implemented yet — coming in Phase 4' },
      { status: 501 },
    )
  },
)
