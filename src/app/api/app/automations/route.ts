import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import type { Id } from '../../../../../convex/_generated/dataModel'

type AutomationSchedule =
  | { kind: 'interval'; intervalMinutes?: number }
  | { kind: 'daily'; hourUTC?: number; minuteUTC?: number }
  | { kind: 'weekly'; dayOfWeekUTC?: number; hourUTC?: number; minuteUTC?: number }
  | { kind: 'monthly'; dayOfMonthUTC?: number; hourUTC?: number; minuteUTC?: number }

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const automationId = request.nextUrl.searchParams.get('automationId')
    const projectId = request.nextUrl.searchParams.get('projectId') || undefined
    const includeDeleted = request.nextUrl.searchParams.get('includeDeleted') === 'true'
    const includeRuns = request.nextUrl.searchParams.get('runs') === 'true'

    if (automationId && includeRuns) {
      const runs = await convex.query('automations:listRuns', {
        automationId: automationId as Id<'automations'>,
        userId: auth.userId,
        serverSecret,
      })
      return NextResponse.json(runs || [])
    }

    if (automationId) {
      const automation = await convex.query('automations:get', {
        automationId: automationId as Id<'automations'>,
        userId: auth.userId,
        serverSecret,
      })
      if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(automation)
    }

    const automations = await convex.query('automations:list', {
      userId: auth.userId,
      serverSecret,
      includeDeleted,
      projectId,
    })
    return NextResponse.json(automations || [])
  } catch (error) {
    console.error('[automations GET]', error)
    return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      accessToken?: string
      userId?: string
      name?: string
      description?: string
      instructions?: string
      enabled?: boolean
      schedule?: AutomationSchedule
      timezone?: string
      projectId?: string
      modelId?: string
      sourceConversationId?: string
      concurrencyPolicy?: 'skip' | 'queue'
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!body.name?.trim() || !body.instructions?.trim() || !body.schedule) {
      return NextResponse.json({ error: 'name, instructions, and schedule are required' }, { status: 400 })
    }
    const id = await convex.mutation('automations:create', {
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
      name: body.name,
      description: body.description,
      instructions: body.instructions,
      enabled: body.enabled,
      schedule: body.schedule,
      timezone: body.timezone,
      projectId: body.projectId,
      modelId: body.modelId,
      sourceConversationId: body.sourceConversationId as Id<'conversations'> | undefined,
      concurrencyPolicy: body.concurrencyPolicy,
    }, { throwOnError: true })
    if (!id) throw new Error('Automation create returned no id')
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('[automations POST]', error)
    return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      accessToken?: string
      userId?: string
      automationId?: string
      action?: 'pause' | 'resume'
      name?: string
      description?: string
      instructions?: string
      enabled?: boolean
      schedule?: AutomationSchedule
      timezone?: string
      projectId?: string
      modelId?: string
      concurrencyPolicy?: 'skip' | 'queue'
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!body.automationId) {
      return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    }

    const args = {
      automationId: body.automationId as Id<'automations'>,
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
    }
    if (body.action === 'pause') {
      await convex.mutation('automations:pause', args, { throwOnError: true })
    } else if (body.action === 'resume') {
      await convex.mutation('automations:resume', args, { throwOnError: true })
    } else {
      await convex.mutation('automations:update', {
        ...args,
        name: body.name,
        description: body.description,
        instructions: body.instructions,
        enabled: body.enabled,
        schedule: body.schedule,
        timezone: body.timezone,
        projectId: body.projectId,
        modelId: body.modelId,
        concurrencyPolicy: body.concurrencyPolicy,
      }, { throwOnError: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[automations PATCH]', error)
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { accessToken?: string; userId?: string; automationId?: string } = {}
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      body = await request.json().catch(() => ({}))
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const automationId = body.automationId || request.nextUrl.searchParams.get('automationId') || ''
    if (!automationId) {
      return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    }
    await convex.mutation('automations:remove', {
      automationId: automationId as Id<'automations'>,
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
    }, { throwOnError: true })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[automations DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
}
