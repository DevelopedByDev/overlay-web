// @enterprise-future — not wired to production
// GET /api/admin/settings — read-only config status
// PUT /api/admin/settings — stubbed (returns 501, logs audit event)

import { NextResponse } from 'next/server'
import { createHandler, withRequireAuth, withAdmin, auditLog } from '@/app/api/lib/middleware'

function buildConfigItems() {
  const envVars: Array<{
    label: string
    key: string
    optional?: boolean
  }> = [
    { label: 'WorkOS API Key', key: 'WORKOS_API_KEY' },
    { label: 'WorkOS Client ID', key: 'WORKOS_CLIENT_ID' },
    { label: 'Stripe Secret Key', key: 'STRIPE_SECRET_KEY', optional: true },
    { label: 'Convex URL', key: 'NEXT_PUBLIC_CONVEX_URL' },
    { label: 'AI Gateway URL', key: 'AI_GATEWAY_URL', optional: true },
    { label: 'R2 Endpoint', key: 'R2_ENDPOINT', optional: true },
    { label: 'MinIO Endpoint', key: 'MINIO_ENDPOINT', optional: true },
    { label: 'Postgres URL', key: 'POSTGRES_URL', optional: true },
    { label: 'Redis URL', key: 'REDIS_URL', optional: true },
    { label: 'Meilisearch URL', key: 'MEILISEARCH_URL', optional: true },
    { label: 'SMTP Host', key: 'SMTP_HOST', optional: true },
    { label: 'Session Secret', key: 'SESSION_SECRET' },
    { label: 'Admin User IDs', key: 'OVERLAY_ADMIN_USER_IDS' },
  ]

  return envVars.map(({ label, key, optional }) => {
    const present = Boolean(process.env[key]?.trim())
    return {
      label,
      value: present ? '••••••••' : '—',
      status: present
        ? ('configured' as const)
        : optional
          ? ('optional' as const)
          : ('missing' as const),
    }
  })
}

export const GET = createHandler(
  { middleware: [withRequireAuth, withAdmin] },
  async (_request, ctx) => {
    auditLog(ctx, { action: 'view_settings', resource: 'admin' })
    return NextResponse.json({ config: buildConfigItems() })
  },
)

export const PUT = createHandler(
  { middleware: [withRequireAuth, withAdmin] },
  async (request, ctx) => {
    const body = await request.text()
    auditLog(ctx, {
      action: 'update_settings_attempt',
      resource: 'admin',
      metadata: { body },
    })
    return NextResponse.json(
      { error: 'Not implemented yet — coming in Phase 4' },
      { status: 501 },
    )
  },
)
