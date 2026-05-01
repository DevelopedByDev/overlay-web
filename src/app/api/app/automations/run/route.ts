import { NextRequest, NextResponse } from 'next/server'
import { runActTurnForScheduledAutomation } from '@/lib/agent/run-act-turn'
import { getInternalApiSecret } from '@/lib/internal-api-secret'

export const maxDuration = 300

function verifyInternalSecret(request: NextRequest): boolean {
  const expected = getInternalApiSecret()
  const received = request.headers.get('x-overlay-internal-secret')?.trim()
  return Boolean(received && received === expected)
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyInternalSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      runId?: string
      turnId?: string
      scheduledFor?: number
      automation?: {
        id?: string
        userId?: string
        name?: string
        description?: string
        instructions?: string
        projectId?: string
        modelId?: string
      }
    }
    const automation = body.automation
    if (
      !body.runId ||
      !body.turnId ||
      typeof body.scheduledFor !== 'number' ||
      !automation?.userId ||
      !automation.name ||
      !automation.instructions
    ) {
      return NextResponse.json({ error: 'Invalid automation run payload' }, { status: 400 })
    }

    const result = await runActTurnForScheduledAutomation({
      runId: body.runId,
      userId: automation.userId,
      name: automation.name,
      description: automation.description,
      instructions: automation.instructions,
      projectId: automation.projectId,
      modelId: automation.modelId,
      turnId: body.turnId,
      scheduledFor: body.scheduledFor,
    })

    return NextResponse.json({
      success: true,
      conversationId: result.conversationId,
    })
  } catch (error) {
    console.error('[automations/run]', error)
    return NextResponse.json(
      {
        error: 'Failed to run automation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
