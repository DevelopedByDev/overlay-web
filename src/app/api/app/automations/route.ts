import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { DEFAULT_MODEL_ID } from '@/lib/models'
import type { Id } from '../../../../../convex/_generated/dataModel'
import type {
  AutomationMode,
  AutomationScheduleConfig,
  AutomationScheduleKind,
  AutomationSourceType,
  AutomationStatus,
} from '@/lib/automations'
import { getNextAutomationRunAt } from '@/lib/automations'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'

type AutomationMutationBody = {
  automationId?: string
  projectId?: string
  title?: string
  description?: string
  sourceType?: AutomationSourceType
  skillId?: string
  instructionsMarkdown?: string
  mode?: AutomationMode
  modelId?: string
  status?: AutomationStatus
  timezone?: string
  scheduleKind?: AutomationScheduleKind
  scheduleConfig?: AutomationScheduleConfig
  accessToken?: string
  userId?: string
}

function normalizeScheduleConfig(
  scheduleKind: AutomationScheduleKind,
  scheduleConfig?: AutomationScheduleConfig,
): AutomationScheduleConfig {
  const next: AutomationScheduleConfig = {
    onceAt: scheduleConfig?.onceAt,
    localTime: scheduleConfig?.localTime?.trim() || undefined,
    weekdays: scheduleConfig?.weekdays?.filter((value) => Number.isInteger(value)),
    dayOfMonth: scheduleConfig?.dayOfMonth,
  }

  if (scheduleKind === 'weekdays') {
    next.weekdays = [1, 2, 3, 4, 5]
  }

  return next
}

function deriveNextRunAt(
  scheduleKind: AutomationScheduleKind,
  scheduleConfig: AutomationScheduleConfig,
  timezone: string,
): number | undefined {
  return getNextAutomationRunAt({
    scheduleKind,
    scheduleConfig,
    timezone,
    afterTimestamp: Date.now(),
  })
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const projectId = request.nextUrl.searchParams.get('projectId')

    const rows = await convex.query('automations:list', {
      userId: auth.userId,
      serverSecret,
      projectId: projectId ?? undefined,
    })
    return NextResponse.json(rows ?? [])
  } catch (error) {
    console.error('[automations] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch automations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AutomationMutationBody
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }
    if (!body.sourceType) {
      return NextResponse.json({ error: 'sourceType required' }, { status: 400 })
    }
    if (!body.mode) {
      return NextResponse.json({ error: 'mode required' }, { status: 400 })
    }
    if (!body.timezone?.trim()) {
      return NextResponse.json({ error: 'timezone required' }, { status: 400 })
    }
    if (!body.scheduleKind) {
      return NextResponse.json({ error: 'scheduleKind required' }, { status: 400 })
    }

    const scheduleConfig = normalizeScheduleConfig(body.scheduleKind, body.scheduleConfig)

    const automationId = await convex.mutation<Id<'automations'>>('automations:create', {
      userId: auth.userId,
      serverSecret,
      projectId: body.projectId?.trim() || undefined,
      title: body.title.trim(),
      description: body.description?.trim() || '',
      sourceType: body.sourceType,
      skillId: body.skillId as Id<'skills'> | undefined,
      instructionsMarkdown: body.instructionsMarkdown?.trim() || undefined,
      mode: body.mode,
      modelId: body.modelId?.trim() || DEFAULT_MODEL_ID,
      status: body.status ?? 'active',
      timezone: body.timezone.trim(),
      scheduleKind: body.scheduleKind,
      scheduleConfig,
      nextRunAt: deriveNextRunAt(body.scheduleKind, scheduleConfig, body.timezone.trim()),
    }, { throwOnError: true })

    return NextResponse.json({ id: automationId })
  } catch (error) {
    console.error('[automations] POST error:', error)
    return NextResponse.json({ error: 'Failed to create automation' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as AutomationMutationBody
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    if (!body.automationId) {
      return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    }

    const nextRunAt =
      body.scheduleKind && body.scheduleConfig && body.timezone?.trim()
        ? deriveNextRunAt(
            body.scheduleKind,
            normalizeScheduleConfig(body.scheduleKind, body.scheduleConfig),
            body.timezone.trim(),
          )
        : undefined

    await convex.mutation('automations:update', {
      automationId: body.automationId as Id<'automations'>,
      userId: auth.userId,
      serverSecret,
      projectId: body.projectId?.trim() || undefined,
      title: body.title,
      description: body.description,
      sourceType: body.sourceType,
      skillId: body.skillId as Id<'skills'> | undefined,
      instructionsMarkdown: body.instructionsMarkdown,
      mode: body.mode,
      modelId: body.modelId,
      status: body.status,
      timezone: body.timezone?.trim() || undefined,
      scheduleKind: body.scheduleKind,
      scheduleConfig: body.scheduleKind ? normalizeScheduleConfig(body.scheduleKind, body.scheduleConfig) : undefined,
      nextRunAt,
    }, { throwOnError: true })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[automations] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { accessToken?: string; userId?: string } = {}
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        body = await request.json()
      } catch {
        body = {}
      }
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const automationId = request.nextUrl.searchParams.get('automationId')
    if (!automationId) return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    const serverSecret = getInternalApiSecret()

    await convex.mutation('automations:remove', {
      automationId: automationId as Id<'automations'>,
      userId: auth.userId,
      serverSecret,
    }, { throwOnError: true })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[automations] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
}
