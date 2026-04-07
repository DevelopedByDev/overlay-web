import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import type { Id } from '../../../../../../convex/_generated/dataModel'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const automationId = request.nextUrl.searchParams.get('automationId')
    if (!automationId) {
      return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    }

    const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '20')
    const limit = Number.isFinite(limitParam) ? limitParam : 20
    const serverSecret = getInternalApiSecret()

    const runs = await convex.query('automations:listRuns', {
      automationId: automationId as Id<'automations'>,
      userId: session.user.id,
      serverSecret,
      limit,
    })

    return NextResponse.json(runs ?? [])
  } catch (error) {
    console.error('[automation runs] GET error:', error)
    return NextResponse.json({ error: 'Failed to load automation runs' }, { status: 500 })
  }
}
