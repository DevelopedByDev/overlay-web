import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'

import { z } from '@/lib/api-schemas'

const AppOnboardingResetRequestSchema = z.object({}).openapi('AppOnboardingResetRequest')
const AppOnboardingResetResponseSchema = z.unknown().openapi('AppOnboardingResetResponse')
void AppOnboardingResetRequestSchema
void AppOnboardingResetResponseSchema

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const result = await convex.mutation('users:resetOnboarding', {
    serverSecret: getInternalApiSecret(),
    userId: session.user.id,
  })

  return NextResponse.json(result ?? { ok: false })
}
