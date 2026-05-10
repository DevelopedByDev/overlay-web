// @enterprise-future — not wired to production
// Server-side admin access guard.
// Admin list is bootstrapped via OVERLAY_ADMIN_USER_IDS env var (comma-separated WorkOS user IDs).
// No Convex schema changes required.

import { getSession } from '@/lib/workos-auth'
import type { AuthSession } from '@/lib/workos-auth'

export interface AdminAuthResult {
  isAdmin: boolean
  userId: string | null
  session: AuthSession | null
}

function getAdminUserIds(): Set<string> {
  const raw = process.env.OVERLAY_ADMIN_USER_IDS?.trim() ?? ''
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

export async function requireAdmin(): Promise<AdminAuthResult> {
  const session = await getSession()
  if (!session) {
    return { isAdmin: false, userId: null, session: null }
  }
  const adminIds = getAdminUserIds()
  const isAdmin = adminIds.has(session.user.id)
  return { isAdmin, userId: session.user.id, session }
}

export async function requireAdminOrRedirect(redirectTo = '/app/chat?signin=nav') {
  const result = await requireAdmin()
  if (!result.isAdmin) {
    return { redirect: redirectTo, result }
  }
  return { redirect: null, result }
}
