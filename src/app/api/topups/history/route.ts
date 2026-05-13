import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'

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
    'subscriptions:listBudgetTopUpsByServer',
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
