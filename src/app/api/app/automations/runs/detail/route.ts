import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getAppAutomationRunDetail } from '@/lib/app-api/automation-service'

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const automationRunId = request.nextUrl.searchParams.get('automationRunId')
    if (!automationRunId) {
      return NextResponse.json({ error: 'automationRunId required' }, { status: 400 })
    }

    const serverSecret = getInternalApiSecret()
    const userId = auth.userId

    const detail = await getAppAutomationRunDetail(userId, serverSecret, automationRunId)
    if (!detail) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('[automation run detail] GET error:', error)
    return NextResponse.json({ error: 'Failed to load automation run detail' }, { status: 500 })
  }
}
