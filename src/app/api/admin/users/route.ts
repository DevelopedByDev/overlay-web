// @enterprise-future — not wired to production
// GET /api/admin/users — list users (read-only, admin-only)

import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { requireAdmin } from '@/lib/admin-auth'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { api } from '../../../../../convex/_generated/api'

function resolveConvexUrl(): string {
  const isDev = process.env.NODE_ENV === 'development'
  if (isDev && process.env.DEV_NEXT_PUBLIC_CONVEX_URL) {
    return process.env.DEV_NEXT_PUBLIC_CONVEX_URL
  }
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return process.env.NEXT_PUBLIC_CONVEX_URL
  throw new Error('CONVEX_URL is not configured')
}

export async function GET(request: Request) {
  const { isAdmin } = await requireAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

  try {
    const convex = new ConvexHttpClient(resolveConvexUrl())
    const users = await convex.query(api.users.listAllUsersForAdmin, {
      serverSecret: getInternalApiSecret(),
      limit,
    })
    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ users: [] })
  }
}
