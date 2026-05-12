import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit'

import { z } from '@/lib/api-schemas'

const AppAutomationsRequestSchema = z.object({ automationId: z.string().optional(), name: z.string().optional(), title: z.string().optional(), description: z.string().optional(), instructions: z.string().optional(), enabled: z.boolean().optional(), schedule: z.any().optional(), timezone: z.string().optional(), modelId: z.string().optional(), projectId: z.string().optional(), sourceConversationId: z.string().optional(), accessToken: z.string().optional(), userId: z.string().optional() }).passthrough().openapi('AppAutomationsRequest')
const AppAutomationsResponseSchema = z.unknown().openapi('AppAutomationsResponse')
void AppAutomationsRequestSchema
void AppAutomationsResponseSchema

type AutomationSchedule =
  | { kind: 'interval'; intervalMinutes?: number }
  | { kind: 'daily'; hourUTC?: number; minuteUTC?: number }
  | { kind: 'weekly'; dayOfWeekUTC?: number; hourUTC?: number; minuteUTC?: number }
  | { kind: 'monthly'; dayOfMonthUTC?: number; hourUTC?: number; minuteUTC?: number }

type AutomationForUpdateNote = {
  _id: Id<'automations'>
  userId: string
  name?: string
  title?: string
  description?: string
  instructions?: string
  enabled?: boolean
  schedule?: AutomationSchedule
  timezone?: string
  modelId?: string
  sourceConversationId?: Id<'conversations'>
  conversationId?: Id<'conversations'>
}

const MIN_INTERVAL_MINUTES = 15
const MAX_ENABLED_AUTOMATIONS = 25

function scheduleTooFrequent(schedule: AutomationSchedule | undefined): boolean {
  return schedule?.kind === 'interval' && (schedule.intervalMinutes ?? 60) < MIN_INTERVAL_MINUTES
}

function stableScheduleKey(schedule: AutomationSchedule | undefined): string {
  if (!schedule) return ''
  if (schedule.kind === 'interval') return `interval:${schedule.intervalMinutes ?? ''}`
  if (schedule.kind === 'daily') return `daily:${schedule.hourUTC ?? ''}:${schedule.minuteUTC ?? ''}`
  if (schedule.kind === 'weekly') return `weekly:${schedule.dayOfWeekUTC ?? ''}:${schedule.hourUTC ?? ''}:${schedule.minuteUTC ?? ''}`
  return `monthly:${schedule.dayOfMonthUTC ?? ''}:${schedule.hourUTC ?? ''}:${schedule.minuteUTC ?? ''}`
}

function formatLocalTime(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }
}

function weekdayName(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
    }).format(date)
  }
}

function dateForUtcSchedule(hourUTC = 9, minuteUTC = 0, dayOffset = 0): Date {
  const now = new Date()
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + dayOffset,
    hourUTC,
    minuteUTC,
  ))
}

function formatSchedule(schedule: AutomationSchedule | undefined, timezone: string | undefined): string {
  if (!schedule) return 'unscheduled'
  const zone = timezone?.trim() || 'UTC'
  if (schedule.kind === 'interval') {
    const minutes = schedule.intervalMinutes ?? 60
    if (minutes % 1440 === 0) return `every ${minutes / 1440} day${minutes === 1440 ? '' : 's'}`
    if (minutes % 60 === 0) return `every ${minutes / 60} hour${minutes === 60 ? '' : 's'}`
    return `every ${minutes} minutes`
  }
  if (schedule.kind === 'daily') {
    return `daily at ${formatLocalTime(dateForUtcSchedule(schedule.hourUTC, schedule.minuteUTC), zone)} ${zone}`
  }
  if (schedule.kind === 'weekly') {
    const today = new Date().getUTCDay()
    const target = schedule.dayOfWeekUTC ?? 1
    const dayOffset = (target - today + 7) % 7
    const date = dateForUtcSchedule(schedule.hourUTC, schedule.minuteUTC, dayOffset)
    return `weekly on ${weekdayName(date, zone)} at ${formatLocalTime(date, zone)} ${zone}`
  }
  const day = schedule.dayOfMonthUTC ?? 1
  return `monthly on day ${day} at ${formatLocalTime(dateForUtcSchedule(schedule.hourUTC, schedule.minuteUTC), zone)} ${zone}`
}

function buildAutomationUpdateNote(
  before: AutomationForUpdateNote,
  after: {
    name?: string
    description?: string
    instructions?: string
    enabled?: boolean
    schedule?: AutomationSchedule
    timezone?: string
    modelId?: string
  },
): string | null {
  const changes: string[] = []
  const beforeName = (before.name || before.title || 'Untitled automation').trim()
  const afterName = after.name !== undefined ? after.name.trim() : beforeName
  if (after.name !== undefined && afterName !== beforeName) changes.push(`name changed to "${afterName || beforeName}"`)

  if (after.description !== undefined && after.description.trim() !== (before.description || '').trim()) {
    changes.push('description updated')
  }
  if (after.instructions !== undefined && after.instructions.trim() !== (before.instructions || '').trim()) {
    changes.push('instructions updated')
  }
  const nextTimezone = after.timezone !== undefined ? after.timezone.trim() || 'UTC' : before.timezone
  if (after.schedule !== undefined && stableScheduleKey(after.schedule) !== stableScheduleKey(before.schedule)) {
    changes.push(`schedule changed to ${formatSchedule(after.schedule, nextTimezone)}`)
  } else if (after.timezone !== undefined && nextTimezone !== (before.timezone || 'UTC')) {
    changes.push(`timezone changed to ${nextTimezone}`)
  }
  if (after.enabled !== undefined && after.enabled !== (before.enabled ?? true)) {
    changes.push(after.enabled ? 'enabled' : 'paused')
  }
  if (after.modelId !== undefined && (after.modelId.trim() || '') !== (before.modelId || '')) {
    changes.push(`model changed to ${after.modelId.trim() || 'default'}`)
  }

  if (changes.length === 0) return null
  return `Automation updated: ${changes.join('; ')}.`
}

async function appendAutomationUpdateNote(params: {
  automation: AutomationForUpdateNote
  userId: string
  serverSecret: string
  content: string
}) {
  const conversationId = params.automation.sourceConversationId || params.automation.conversationId
  if (!conversationId) return
  await convex.mutation('conversations:addMessage', {
    conversationId,
    userId: params.userId,
    serverSecret: params.serverSecret,
    turnId: `automation-update-${params.automation._id}-${Date.now()}`,
    role: 'assistant',
    mode: 'act',
    content: params.content,
    contentType: 'text',
    parts: [{ type: 'text', text: params.content }],
  }, { throwOnError: true })
}

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
      graphSource?: string
      sourceConversationId?: string
      concurrencyPolicy?: 'skip' | 'queue'
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'automations:write:ip', key: getClientIp(request), limit: 30, windowMs: 10 * 60_000 },
      { bucket: 'automations:write:user', key: auth.userId, limit: 15, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse
    if (!body.name?.trim() || !body.description?.trim() || !body.instructions?.trim() || !body.schedule) {
      return NextResponse.json({ error: 'name, description, instructions, and schedule are required' }, { status: 400 })
    }
    if (scheduleTooFrequent(body.schedule)) {
      return NextResponse.json({ error: `Interval automations must run at least ${MIN_INTERVAL_MINUTES} minutes apart.` }, { status: 400 })
    }
    if (body.enabled !== false) {
      const serverSecret = getInternalApiSecret()
      const entitlements = await convex.query<{ planKind?: 'free' | 'paid' }>('usage:getEntitlementsByServer', {
        userId: auth.userId,
        serverSecret,
      })
      if (entitlements?.planKind !== 'paid') {
        return NextResponse.json({ error: 'Enabled automations require a paid plan.' }, { status: 403 })
      }
      const existing = await convex.query<Array<{ enabled?: boolean }>>('automations:list', {
        userId: auth.userId,
        serverSecret,
      })
      if ((existing || []).filter((item) => item.enabled !== false).length >= MAX_ENABLED_AUTOMATIONS) {
        return NextResponse.json({ error: `You can enable up to ${MAX_ENABLED_AUTOMATIONS} automations.` }, { status: 403 })
      }
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
      graphSource: body.graphSource,
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
      graphSource?: string
      concurrencyPolicy?: 'skip' | 'queue'
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'automations:update:ip', key: getClientIp(request), limit: 60, windowMs: 10 * 60_000 },
      { bucket: 'automations:update:user', key: auth.userId, limit: 30, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse
    if (!body.automationId) {
      return NextResponse.json({ error: 'automationId required' }, { status: 400 })
    }
    if (scheduleTooFrequent(body.schedule)) {
      return NextResponse.json({ error: `Interval automations must run at least ${MIN_INTERVAL_MINUTES} minutes apart.` }, { status: 400 })
    }

    const serverSecret = getInternalApiSecret()
    if (body.action === 'resume' || body.enabled === true) {
      const entitlements = await convex.query<{ planKind?: 'free' | 'paid' }>('usage:getEntitlementsByServer', {
        userId: auth.userId,
        serverSecret,
      })
      if (entitlements?.planKind !== 'paid') {
        return NextResponse.json({ error: 'Enabled automations require a paid plan.' }, { status: 403 })
      }
    }
    const args = {
      automationId: body.automationId as Id<'automations'>,
      userId: auth.userId,
      serverSecret,
    }
    if (body.action === 'pause') {
      await convex.mutation('automations:pause', args, { throwOnError: true })
    } else if (body.action === 'resume') {
      await convex.mutation('automations:resume', args, { throwOnError: true })
    } else {
      const before = await convex.query('automations:get', args) as AutomationForUpdateNote | null
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
        graphSource: body.graphSource,
        concurrencyPolicy: body.concurrencyPolicy,
      }, { throwOnError: true })
      if (before) {
        const updateNote = buildAutomationUpdateNote(before, {
          name: body.name,
          description: body.description,
          instructions: body.instructions,
          enabled: body.enabled,
          schedule: body.schedule,
          timezone: body.timezone,
          modelId: body.modelId,
        })
        if (updateNote) {
          await appendAutomationUpdateNote({
            automation: before,
            userId: auth.userId,
            serverSecret,
            content: updateNote,
          }).catch((error) => {
            console.warn('[automations PATCH] Failed to append automation update note', error)
          })
        }
      }
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
    const serverSecret = getInternalApiSecret()
    const automation = await convex.query('automations:get', {
      automationId: automationId as Id<'automations'>,
      userId: auth.userId,
      serverSecret,
    }) as AutomationForUpdateNote | null
    const linkedConversationIds = [
      automation?.conversationId,
    ].filter((id, index, ids): id is Id<'conversations'> => Boolean(id && ids.indexOf(id) === index))

    await convex.mutation('automations:remove', {
      automationId: automationId as Id<'automations'>,
      userId: auth.userId,
      serverSecret,
    }, { throwOnError: true })

    for (const conversationId of linkedConversationIds) {
      await convex.mutation('conversations:remove', {
        conversationId,
        userId: auth.userId,
        serverSecret,
      }, { throwOnError: true }).catch((error) => {
        console.warn('[automations DELETE] Failed to delete linked conversation', error)
      })
    }

    return NextResponse.json({ success: true, linkedConversationIds })
  } catch (error) {
    console.error('[automations DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 })
  }
}
