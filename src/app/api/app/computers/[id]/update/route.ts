import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'

type UpdateAction = 'check' | 'apply' | 'reprovision'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { action, targetVersion }: { action?: UpdateAction; targetVersion?: string } =
      await request.json()
    const serverSecret = getInternalApiSecret()

    if (action !== 'check' && action !== 'apply' && action !== 'reprovision') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (action === 'reprovision') {
      const result = await convex.action('computers:repairComputerInstance', {
        computerId: id,
        userId: session.user.id,
        serverSecret,
      })

      return NextResponse.json(result)
    }

    const result = await convex.action('computers:updateComputerSoftware', {
      computerId: id,
      userId: session.user.id,
      serverSecret,
      targetVersion: targetVersion?.trim() || undefined,
      checkOnly: action === 'check',
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update computer'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
