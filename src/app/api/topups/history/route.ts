import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/server/database/convex'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'

export async function GET(request: NextRequest) {
  const auth = await resolveAuthenticatedAppUser(request, {})
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rows = await convex.query<
    Array<{
      _id: string
      amountCents: number
      source: 'manual' | 'auto'
      status: 'pending' | 'succeeded' | 'failed' | 'canceled'
      createdAt: number
      updatedAt: number
      errorMessage?: string
    }>
  >(
    'billing/subscriptions:listBudgetTopUpsByServer',
    {
      serverSecret: getInternalApiSecret(),
      userId: auth.userId,
    },
    { throwOnError: true },
  )

  return NextResponse.json({
    items: rows ?? [],
  })
}
