import { v } from 'convex/values'
import { internalMutation, mutation, query, type MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireAccessToken, validateServerSecret } from './lib/auth'
import {
  buildAutomationPrompt,
  formatAutomationSchedule,
  getNextAutomationRunAt,
} from '../src/lib/automations'
import {
  AUTOMATION_RETRY_DELAY_MS,
  MAX_AUTOMATION_ATTEMPTS,
  MAX_RUNNING_AUTOMATIONS_PER_USER,
  shouldRetryAutomationFailure,
} from '../src/lib/automation-guardrails'

async function authorizeUserAccess(params: {
  accessToken?: string
  serverSecret?: string
  userId: string
}) {
  if (validateServerSecret(params.serverSecret)) {
    return
  }
  await requireAccessToken(params.accessToken ?? '', params.userId)
}

const scheduleConfigValidator = v.object({
  onceAt: v.optional(v.number()),
  localTime: v.optional(v.string()),
  weekdays: v.optional(v.array(v.number())),
  dayOfMonth: v.optional(v.number()),
})

function validateSchedule(args: {
  scheduleKind: 'once' | 'daily' | 'weekdays' | 'weekly' | 'monthly'
  scheduleConfig: {
    onceAt?: number
    localTime?: string
    weekdays?: number[]
    dayOfMonth?: number
  }
}) {
  const { scheduleKind, scheduleConfig } = args
  if (scheduleKind === 'once') {
    if (!scheduleConfig.onceAt || !Number.isFinite(scheduleConfig.onceAt)) {
      throw new Error('One-time automations require onceAt')
    }
    return
  }

  if (!scheduleConfig.localTime?.trim()) {
    throw new Error('Recurring automations require localTime')
  }

  if (scheduleKind === 'weekly') {
    if (!scheduleConfig.weekdays?.length) {
      throw new Error('Weekly automations require at least one weekday')
    }
  }

  if (scheduleKind === 'monthly') {
    const dayOfMonth = scheduleConfig.dayOfMonth
    if (!Number.isInteger(dayOfMonth) || dayOfMonth! < 1 || dayOfMonth! > 31) {
      throw new Error('Monthly automations require dayOfMonth between 1 and 31')
    }
  }
}

async function ensureProjectOwnership(ctx: MutationCtx, userId: string, projectId?: string) {
  if (!projectId) return
  const project = await ctx.db.get(projectId as Id<'projects'>)
  if (!project || project.userId !== userId || project.deletedAt) {
    throw new Error('Unauthorized')
  }
}

async function ensureSkillOwnership(ctx: MutationCtx, userId: string, skillId?: Id<'skills'>) {
  if (!skillId) return null
  const skill = await ctx.db.get(skillId)
  if (!skill || skill.userId !== userId) {
    throw new Error('Unauthorized')
  }
  return skill
}

function buildClearedLeasePatch() {
  return {
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
  }
}

async function getRunningAutomationRunCount(ctx: MutationCtx, userId: string): Promise<number> {
  const running = await ctx.db
    .query('automationRuns')
    .withIndex('by_userId_status_createdAt', (q) => q.eq('userId', userId).eq('status', 'running'))
    .collect()
  return running.length
}

async function hasScheduledOccurrenceRun(
  ctx: MutationCtx,
  automationId: Id<'automations'>,
  scheduledFor: number,
): Promise<boolean> {
  const existing = await ctx.db
    .query('automationRuns')
    .withIndex('by_automationId_scheduledFor', (q) =>
      q.eq('automationId', automationId).eq('scheduledFor', scheduledFor),
    )
    .collect()
  return existing.some((run) => run.triggerSource === 'schedule')
}

async function existingRetryForRun(
  ctx: MutationCtx,
  automationId: Id<'automations'>,
  retryOfRunId: Id<'automationRuns'>,
) {
  const rows = await ctx.db
    .query('automationRuns')
    .withIndex('by_automationId_createdAt', (q) => q.eq('automationId', automationId))
    .order('desc')
    .take(50)
  return rows.find((row) => row.retryOfRunId === retryOfRunId)
}

async function maybeEnqueueRetryRun(
  ctx: MutationCtx,
  input: {
    run: Doc<'automationRuns'>
    automation: Doc<'automations'>
    errorCode?: string
    errorMessage?: string
  },
): Promise<Id<'automationRuns'> | null> {
  const { run, automation, errorCode, errorMessage } = input
  const attemptNumber = run.attemptNumber ?? 1

  if (
    automation.deletedAt ||
    automation.status !== 'active' ||
    !shouldRetryAutomationFailure({
      errorCode,
      errorMessage,
      attemptNumber,
      triggerSource: run.triggerSource,
    })
  ) {
    return null
  }

  const existingRetry = await existingRetryForRun(ctx, automation._id, run._id)
  if (existingRetry) {
    return existingRetry._id
  }

  return await ctx.db.insert('automationRuns', {
    automationId: automation._id,
    userId: run.userId,
    status: 'queued',
    triggerSource: 'retry',
    scheduledFor: Date.now() + AUTOMATION_RETRY_DELAY_MS,
    promptSnapshot: run.promptSnapshot,
    mode: run.mode,
    modelId: run.modelId,
    conversationId: run.conversationId,
    attemptNumber: Math.min(attemptNumber + 1, MAX_AUTOMATION_ATTEMPTS),
    retryOfRunId: run._id,
    createdAt: Date.now(),
  })
}

function validateAutomationSource(input: {
  sourceType: 'skill' | 'inline'
  skillId?: Id<'skills'>
  instructionsMarkdown?: string
}) {
  if (input.sourceType === 'skill') {
    if (!input.skillId) throw new Error('skillId required for skill automations')
    return
  }
  if (!input.instructionsMarkdown?.trim()) {
    throw new Error('instructionsMarkdown required for inline automations')
  }
}

export const list = query({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, accessToken, serverSecret, projectId }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }

    const rows = await ctx.db
      .query('automations')
      .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()

    return rows.filter((row) => !row.deletedAt && (projectId !== undefined ? row.projectId === projectId : true))
  },
})

export const get = query({
  args: {
    automationId: v.id('automations'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { automationId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const row = await ctx.db.get(automationId)
    if (!row || row.userId !== userId || row.deletedAt) return null
    return row
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    projectId: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    sourceType: v.union(v.literal('skill'), v.literal('inline')),
    skillId: v.optional(v.id('skills')),
    instructionsMarkdown: v.optional(v.string()),
    mode: v.union(v.literal('ask'), v.literal('act')),
    modelId: v.string(),
    status: v.optional(v.union(v.literal('active'), v.literal('paused'), v.literal('archived'))),
    timezone: v.string(),
    scheduleKind: v.union(
      v.literal('once'),
      v.literal('daily'),
      v.literal('weekdays'),
      v.literal('weekly'),
      v.literal('monthly'),
    ),
    scheduleConfig: scheduleConfigValidator,
    nextRunAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)
    await ensureProjectOwnership(ctx, args.userId, args.projectId)
    validateAutomationSource(args)
    validateSchedule(args)
    await ensureSkillOwnership(ctx, args.userId, args.skillId)

    const now = Date.now()
    return await ctx.db.insert('automations', {
      userId: args.userId,
      projectId: args.projectId,
      title: args.title.trim() || 'Untitled automation',
      description: args.description.trim(),
      sourceType: args.sourceType,
      skillId: args.skillId,
      instructionsMarkdown: args.instructionsMarkdown?.trim() || undefined,
      mode: args.mode,
      modelId: args.modelId,
      status: args.status ?? 'active',
      timezone: args.timezone,
      scheduleKind: args.scheduleKind,
      scheduleConfig: args.scheduleConfig,
      nextRunAt: args.nextRunAt,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    automationId: v.id('automations'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    projectId: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    sourceType: v.optional(v.union(v.literal('skill'), v.literal('inline'))),
    skillId: v.optional(v.id('skills')),
    instructionsMarkdown: v.optional(v.string()),
    mode: v.optional(v.union(v.literal('ask'), v.literal('act'))),
    modelId: v.optional(v.string()),
    status: v.optional(v.union(v.literal('active'), v.literal('paused'), v.literal('archived'))),
    timezone: v.optional(v.string()),
    scheduleKind: v.optional(v.union(
      v.literal('once'),
      v.literal('daily'),
      v.literal('weekdays'),
      v.literal('weekly'),
      v.literal('monthly'),
    )),
    scheduleConfig: v.optional(scheduleConfigValidator),
    nextRunAt: v.optional(v.number()),
    conversationId: v.optional(v.id('conversations')),
    lastRunAt: v.optional(v.number()),
    lastRunStatus: v.optional(v.union(
      v.literal('queued'),
      v.literal('running'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('skipped'),
      v.literal('canceled'),
    )),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)
    const existing = await ctx.db.get(args.automationId)
    if (!existing || existing.userId !== args.userId || existing.deletedAt) {
      throw new Error('Unauthorized')
    }

    const nextSourceType = args.sourceType ?? existing.sourceType
    const nextSkillId = args.skillId !== undefined ? args.skillId : existing.skillId
    const nextInstructions = args.instructionsMarkdown !== undefined
      ? args.instructionsMarkdown
      : existing.instructionsMarkdown
    validateAutomationSource({
      sourceType: nextSourceType,
      skillId: nextSkillId,
      instructionsMarkdown: nextInstructions,
    })

    const nextScheduleKind = args.scheduleKind ?? existing.scheduleKind
    const nextScheduleConfig = args.scheduleConfig ?? existing.scheduleConfig
    validateSchedule({
      scheduleKind: nextScheduleKind,
      scheduleConfig: nextScheduleConfig,
    })

    await ensureProjectOwnership(
      ctx,
      args.userId,
      args.projectId !== undefined ? args.projectId : existing.projectId,
    )
    await ensureSkillOwnership(ctx, args.userId, nextSkillId)

    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId)
      if (!conversation || conversation.userId !== args.userId || conversation.deletedAt) {
        throw new Error('Unauthorized')
      }
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.projectId !== undefined) patch.projectId = args.projectId || undefined
    if (args.title !== undefined) patch.title = args.title.trim() || 'Untitled automation'
    if (args.description !== undefined) patch.description = args.description.trim()
    if (args.sourceType !== undefined) patch.sourceType = args.sourceType
    if (args.skillId !== undefined) patch.skillId = args.skillId
    if (args.instructionsMarkdown !== undefined) patch.instructionsMarkdown = args.instructionsMarkdown.trim() || undefined
    if (args.mode !== undefined) patch.mode = args.mode
    if (args.modelId !== undefined) patch.modelId = args.modelId
    if (args.status !== undefined) patch.status = args.status
    if (args.timezone !== undefined) patch.timezone = args.timezone
    if (args.scheduleKind !== undefined) patch.scheduleKind = args.scheduleKind
    if (args.scheduleConfig !== undefined) patch.scheduleConfig = args.scheduleConfig
    if (args.nextRunAt !== undefined) patch.nextRunAt = args.nextRunAt
    if (args.conversationId !== undefined) patch.conversationId = args.conversationId
    if (args.lastRunAt !== undefined) patch.lastRunAt = args.lastRunAt
    if (args.lastRunStatus !== undefined) patch.lastRunStatus = args.lastRunStatus
    await ctx.db.patch(args.automationId, patch)
  },
})

export const remove = mutation({
  args: {
    automationId: v.id('automations'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { automationId, userId, accessToken, serverSecret }) => {
    await authorizeUserAccess({ userId, accessToken, serverSecret })
    const existing = await ctx.db.get(automationId)
    if (!existing || existing.userId !== userId || existing.deletedAt) {
      throw new Error('Unauthorized')
    }
    await ctx.db.patch(automationId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      status: 'archived',
    })
  },
})

export const listRuns = query({
  args: {
    automationId: v.id('automations'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { automationId, userId, accessToken, serverSecret, limit }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return []
    }
    const automation = await ctx.db.get(automationId)
    if (!automation || automation.userId !== userId || automation.deletedAt) {
      return []
    }
    const rows = await ctx.db
      .query('automationRuns')
      .withIndex('by_automationId_createdAt', (q) => q.eq('automationId', automationId))
      .order('desc')
      .collect()
    return rows.slice(0, Math.max(1, Math.min(limit ?? 20, 100)))
  },
})

export const getRun = query({
  args: {
    automationRunId: v.id('automationRuns'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { automationRunId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const run = await ctx.db.get(automationRunId)
    if (!run || run.userId !== userId) return null
    return run
  },
})

export const findRetryRun = query({
  args: {
    automationId: v.id('automations'),
    automationRunId: v.id('automationRuns'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, { automationId, automationRunId, userId, accessToken, serverSecret }) => {
    try {
      await authorizeUserAccess({ userId, accessToken, serverSecret })
    } catch {
      return null
    }
    const automation = await ctx.db.get(automationId)
    if (!automation || automation.userId !== userId || automation.deletedAt) return null
    const rows = await ctx.db
      .query('automationRuns')
      .withIndex('by_automationId_createdAt', (q) => q.eq('automationId', automationId))
      .order('desc')
      .take(100)
    return rows.find((row) => row.retryOfRunId === automationRunId) ?? null
  },
})

export const createRun = mutation({
  args: {
    automationId: v.id('automations'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    status: v.union(
      v.literal('queued'),
      v.literal('running'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('skipped'),
      v.literal('canceled'),
    ),
    triggerSource: v.union(v.literal('manual'), v.literal('schedule'), v.literal('retry')),
    scheduledFor: v.number(),
    promptSnapshot: v.string(),
    mode: v.union(v.literal('ask'), v.literal('act')),
    modelId: v.string(),
    conversationId: v.optional(v.id('conversations')),
    turnId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    attemptNumber: v.optional(v.number()),
    retryOfRunId: v.optional(v.id('automationRuns')),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)
    const automation = await ctx.db.get(args.automationId)
    if (!automation || automation.userId !== args.userId || automation.deletedAt) {
      throw new Error('Unauthorized')
    }
    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId)
      if (!conversation || conversation.userId !== args.userId || conversation.deletedAt) {
        throw new Error('Unauthorized')
      }
    }
    if (args.retryOfRunId) {
      const retryOfRun = await ctx.db.get(args.retryOfRunId)
      if (!retryOfRun || retryOfRun.userId !== args.userId) {
        throw new Error('Unauthorized')
      }
    }
    if (args.status === 'running') {
      const runningCount = await getRunningAutomationRunCount(ctx, args.userId)
      if (runningCount >= MAX_RUNNING_AUTOMATIONS_PER_USER) {
        throw new Error('Too many automation runs are already in progress.')
      }
    }
    const createdAt = Date.now()
    return await ctx.db.insert('automationRuns', {
      automationId: args.automationId,
      userId: args.userId,
      status: args.status,
      triggerSource: args.triggerSource,
      scheduledFor: args.scheduledFor,
      startedAt: args.startedAt,
      conversationId: args.conversationId,
      turnId: args.turnId,
      attemptNumber: Math.max(1, Math.min(args.attemptNumber ?? 1, MAX_AUTOMATION_ATTEMPTS)),
      retryOfRunId: args.retryOfRunId,
      promptSnapshot: args.promptSnapshot,
      mode: args.mode,
      modelId: args.modelId,
      createdAt,
    })
  },
})

export const updateRun = mutation({
  args: {
    automationRunId: v.id('automationRuns'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal('queued'),
      v.literal('running'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('skipped'),
      v.literal('canceled'),
    )),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    conversationId: v.optional(v.id('conversations')),
    turnId: v.optional(v.string()),
    resultSummary: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)
    const run = await ctx.db.get(args.automationRunId)
    if (!run || run.userId !== args.userId) {
      throw new Error('Unauthorized')
    }
    if (args.conversationId) {
      const conversation = await ctx.db.get(args.conversationId)
      if (!conversation || conversation.userId !== args.userId || conversation.deletedAt) {
        throw new Error('Unauthorized')
      }
    }
    if (args.status === 'running' && run.status !== 'running') {
      const runningCount = await getRunningAutomationRunCount(ctx, args.userId)
      if (runningCount >= MAX_RUNNING_AUTOMATIONS_PER_USER) {
        throw new Error('Too many automation runs are already in progress.')
      }
    }
    const patch: Record<string, unknown> = {}
    if (args.status !== undefined) patch.status = args.status
    if (args.startedAt !== undefined) patch.startedAt = args.startedAt
    if (args.finishedAt !== undefined) patch.finishedAt = args.finishedAt
    if (args.durationMs !== undefined) patch.durationMs = args.durationMs
    if (args.conversationId !== undefined) patch.conversationId = args.conversationId
    if (args.turnId !== undefined) patch.turnId = args.turnId
    if (args.resultSummary !== undefined) patch.resultSummary = args.resultSummary
    if (args.errorCode !== undefined) patch.errorCode = args.errorCode
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage
    await ctx.db.patch(args.automationRunId, patch)

    const automation = await ctx.db.get(run.automationId)
    if (automation && automation.userId === args.userId && !automation.deletedAt && args.status) {
      await ctx.db.patch(run.automationId, {
        updatedAt: Date.now(),
        ...((args.status === 'succeeded' || args.status === 'failed' || args.status === 'canceled')
          ? buildClearedLeasePatch()
          : {}),
        ...(args.conversationId !== undefined ? { conversationId: args.conversationId } : {}),
        ...(args.status ? { lastRunStatus: args.status } : {}),
        ...((args.status === 'succeeded' || args.status === 'failed' || args.status === 'canceled')
          ? { lastRunAt: args.finishedAt ?? Date.now() }
          : {}),
      })
    }
  },
})

export const claimDueRunsInternal = internalMutation({
  args: {
    now: v.number(),
    batchSize: v.number(),
    leaseMs: v.number(),
  },
  handler: async (ctx, { now, batchSize, leaseMs }) => {
    const candidates = await ctx.db
      .query('automations')
      .withIndex('by_status_nextRunAt', (q) => q.eq('status', 'active').lte('nextRunAt', now))
      .take(Math.max(batchSize * 5, 20))

    const jobs: Array<{
      automationId: Id<'automations'>
      automationRunId: Id<'automationRuns'>
      userId: string
    }> = []
    const runningCounts = new Map<string, number>()

    for (const automation of candidates) {
      if (jobs.length >= batchSize) break
      if (automation.deletedAt) continue
      if (!automation.nextRunAt || automation.nextRunAt > now) continue
      if (automation.leaseExpiresAt && automation.leaseExpiresAt > now) continue
      const currentRunningCount =
        runningCounts.get(automation.userId) ?? (await getRunningAutomationRunCount(ctx, automation.userId))
      runningCounts.set(automation.userId, currentRunningCount)
      if (currentRunningCount >= MAX_RUNNING_AUTOMATIONS_PER_USER) {
        continue
      }
      if (await hasScheduledOccurrenceRun(ctx, automation._id, automation.nextRunAt)) {
        const nextRunAt = getNextAutomationRunAt({
          scheduleKind: automation.scheduleKind,
          scheduleConfig: automation.scheduleConfig,
          timezone: automation.timezone,
          afterTimestamp: automation.nextRunAt,
        })
        await ctx.db.patch(automation._id, {
          updatedAt: now,
          ...buildClearedLeasePatch(),
          nextRunAt,
          status: nextRunAt ? automation.status : 'archived',
        })
        continue
      }

      const sourceInstructions =
        automation.sourceType === 'inline'
          ? automation.instructionsMarkdown?.trim() || ''
          : ((automation.skillId ? await ctx.db.get(automation.skillId) : null)?.instructions?.trim() || '')
      const promptSnapshot = buildAutomationPrompt({
        title: automation.title,
        description: automation.description,
        scheduleLabel: formatAutomationSchedule(
          automation.scheduleKind,
          automation.scheduleConfig,
          automation.timezone,
        ),
        timezone: automation.timezone,
        sourceInstructions,
      })

      const automationRunId = await ctx.db.insert('automationRuns', {
        automationId: automation._id,
        userId: automation.userId,
        status: 'queued',
        triggerSource: 'schedule',
        scheduledFor: automation.nextRunAt,
        promptSnapshot,
        mode: automation.mode,
        modelId: automation.modelId,
        attemptNumber: 1,
        createdAt: now,
      })

      const nextRunAt = getNextAutomationRunAt({
        scheduleKind: automation.scheduleKind,
        scheduleConfig: automation.scheduleConfig,
        timezone: automation.timezone,
        afterTimestamp: automation.nextRunAt,
      })

      await ctx.db.patch(automation._id, {
        updatedAt: now,
        leaseOwner: automationRunId,
        leaseExpiresAt: now + leaseMs,
        nextRunAt,
        status: nextRunAt ? automation.status : 'archived',
        lastRunStatus: 'queued',
      })

      jobs.push({
        automationId: automation._id,
        automationRunId,
        userId: automation.userId,
      })
    }

    return jobs
  },
})

export const claimRetryRunsInternal = internalMutation({
  args: {
    now: v.number(),
    batchSize: v.number(),
  },
  handler: async (ctx, { now, batchSize }) => {
    const candidates = await ctx.db
      .query('automationRuns')
      .withIndex('by_status_scheduledFor', (q) => q.eq('status', 'queued').lte('scheduledFor', now))
      .take(Math.max(batchSize * 5, 20))

    const jobs: Array<{
      automationId: Id<'automations'>
      automationRunId: Id<'automationRuns'>
      userId: string
    }> = []
    const runningCounts = new Map<string, number>()

    for (const run of candidates) {
      if (jobs.length >= batchSize) break
      if (run.triggerSource !== 'retry') continue

      const automation = await ctx.db.get(run.automationId)
      if (!automation || automation.deletedAt || automation.status !== 'active') {
        await ctx.db.patch(run._id, {
          status: 'canceled',
          finishedAt: now,
          durationMs: 0,
          errorCode: 'retry_canceled',
          errorMessage: 'Automation is no longer active.',
        })
        continue
      }

      const currentRunningCount =
        runningCounts.get(run.userId) ?? (await getRunningAutomationRunCount(ctx, run.userId))
      runningCounts.set(run.userId, currentRunningCount)
      if (currentRunningCount >= MAX_RUNNING_AUTOMATIONS_PER_USER) {
        continue
      }

      await ctx.db.patch(run._id, {
        status: 'running',
        startedAt: now,
      })
      runningCounts.set(run.userId, currentRunningCount + 1)

      jobs.push({
        automationId: run.automationId,
        automationRunId: run._id,
        userId: run.userId,
      })
    }

    return jobs
  },
})

export const queueRetryForRun = mutation({
  args: {
    automationRunId: v.id('automationRuns'),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    serverSecret: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await authorizeUserAccess(args)
    const run = await ctx.db.get(args.automationRunId)
    if (!run || run.userId !== args.userId) {
      throw new Error('Unauthorized')
    }
    const automation = await ctx.db.get(run.automationId)
    if (!automation || automation.userId !== args.userId || automation.deletedAt) {
      throw new Error('Unauthorized')
    }
    return await maybeEnqueueRetryRun(ctx, {
      run,
      automation,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
    })
  },
})

export const markDispatchFailedInternal = internalMutation({
  args: {
    automationRunId: v.id('automationRuns'),
    errorMessage: v.string(),
  },
  handler: async (ctx, { automationRunId, errorMessage }) => {
    const run = await ctx.db.get(automationRunId)
    if (!run) return

    const finishedAt = Date.now()
    await ctx.db.patch(automationRunId, {
      status: 'failed',
      finishedAt,
      durationMs: Math.max(0, finishedAt - (run.startedAt ?? run.createdAt)),
      errorCode: 'dispatch_failed',
      errorMessage,
    })

    const automation = await ctx.db.get(run.automationId)
    if (!automation || automation.deletedAt) return

    await maybeEnqueueRetryRun(ctx, {
      run: {
        ...run,
        status: 'failed',
        finishedAt,
        durationMs: Math.max(0, finishedAt - (run.startedAt ?? run.createdAt)),
        errorCode: 'dispatch_failed',
        errorMessage,
      },
      automation,
      errorCode: 'dispatch_failed',
      errorMessage,
    })

    await ctx.db.patch(run.automationId, {
      updatedAt: finishedAt,
      ...buildClearedLeasePatch(),
      lastRunAt: finishedAt,
      lastRunStatus: 'failed',
    })
  },
})
