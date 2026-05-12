import { z } from '@/lib/api-schemas'

const AdminAuditRequestSchema = z.object({ limit: z.coerce.number().int().optional(), action: z.string().optional(), actorId: z.string().optional() }).openapi('AdminAuditRequest')
const AdminAuditResponseSchema = z.unknown().openapi('AdminAuditResponse')
void AdminAuditRequestSchema
void AdminAuditResponseSchema

// @enterprise-future — not wired to production
// GET /api/admin/audit — recent audit events (admin-only)

import { NextResponse } from 'next/server'
import { createHandler, withRequireAuth, withAdmin } from '@/app/api/lib/middleware'
import { getRecentAuditEvents } from '@/lib/audit'

export const GET = createHandler(
  { middleware: [withRequireAuth, withAdmin] },
  async (request) => {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const action = searchParams.get('action') || undefined
    const actorId = searchParams.get('actorId') || undefined

    const events = getRecentAuditEvents({ limit, action, actorId })
    return NextResponse.json({ events })
  },
)
