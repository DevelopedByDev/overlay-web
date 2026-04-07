import { v } from 'convex/values'
import { mutation, query, type MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireAccessToken, validateServerSecret } from './lib/auth'

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
    startedAt: v.optional(v.number()),
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
    const createdAt = Date.now()
    return await ctx.db.insert('automationRuns', {
      automationId: args.automationId,
      userId: args.userId,
      status: args.status,
      triggerSource: args.triggerSource,
      scheduledFor: args.scheduledFor,
      startedAt: args.startedAt,
      conversationId: args.conversationId,
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
    const patch: Record<string, unknown> = {}
    if (args.status !== undefined) patch.status = args.status
    if (args.startedAt !== undefined) patch.startedAt = args.startedAt
    if (args.finishedAt !== undefined) patch.finishedAt = args.finishedAt
    if (args.durationMs !== undefined) patch.durationMs = args.durationMs
    if (args.conversationId !== undefined) patch.conversationId = args.conversationId
    if (args.resultSummary !== undefined) patch.resultSummary = args.resultSummary
    if (args.errorCode !== undefined) patch.errorCode = args.errorCode
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage
    await ctx.db.patch(args.automationRunId, patch)

    const automation = await ctx.db.get(run.automationId)
    if (automation && automation.userId === args.userId && !automation.deletedAt && args.status) {
      await ctx.db.patch(run.automationId, {
        updatedAt: Date.now(),
        ...(args.conversationId !== undefined ? { conversationId: args.conversationId } : {}),
        ...(args.status ? { lastRunStatus: args.status } : {}),
        ...((args.status === 'succeeded' || args.status === 'failed' || args.status === 'canceled')
          ? { lastRunAt: args.finishedAt ?? Date.now() }
          : {}),
      })
    }
  },
})
