import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const auth = await resolveAuthenticatedAppUser(request, body)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const result = await convex.mutation('auth/users:resetOnboarding', {
    serverSecret: getInternalApiSecret(),
    userId: auth.userId,
  })

  return NextResponse.json(result ?? { ok: false })
}
