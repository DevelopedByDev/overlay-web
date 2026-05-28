import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'

export async function POST(request: NextRequest, context: AppApiRouteContext) {
  void request
  const { auth } = context

  const result = await convex.mutation('auth/users:resetOnboarding', {
    serverSecret: getInternalApiSecret(),
    userId: auth.userId,
  })

  return NextResponse.json(result ?? { ok: false })
}
