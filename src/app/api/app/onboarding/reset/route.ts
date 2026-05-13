import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const auth = await resolveAuthenticatedAppUser(request, body)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const result = await convex.mutation('users:resetOnboarding', {
    serverSecret: getInternalApiSecret(),
    userId: auth.userId,
  })

  return NextResponse.json(result ?? { ok: false })
}
