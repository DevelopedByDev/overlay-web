import { NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'

import { z } from '@/lib/api-schemas'

const TopupsHistoryRequestSchema = z.object({}).openapi('TopupsHistoryRequest')
const TopupsHistoryResponseSchema = z.unknown().openapi('TopupsHistoryResponse')
void TopupsHistoryRequestSchema
void TopupsHistoryResponseSchema

export async function GET() {
  const session = await getSession()
  if (!session?.user) {
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
      userId: session.user.id,
    },
    { throwOnError: true },
  )

  return NextResponse.json({
    items: rows ?? [],
  })
}
