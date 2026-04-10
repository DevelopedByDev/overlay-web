import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { listAppAutomationRuns } from '@/lib/app-api/automation-service'

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const automationId = request.nextUrl.searchParams.get('automationId')
    if (!automationId) {
      return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    }

    const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '20')
    const limit = Number.isFinite(limitParam) ? limitParam : 20
    const serverSecret = getInternalApiSecret()

    return NextResponse.json(
      await listAppAutomationRuns(auth.userId, serverSecret, automationId, { limit }),
    )
  } catch (error) {
    console.error('[automation runs] GET error:', error)
    return NextResponse.json({ error: 'Failed to load automation runs' }, { status: 500 })
  }
}
