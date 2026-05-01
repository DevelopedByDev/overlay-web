import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import type { Id } from './_generated/dataModel'

function summarizeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown automation error'
  }
}

function getAutomationRunnerBaseUrl(): string {
  const explicit = process.env.AUTOMATION_RUNNER_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  const appUrl =
    process.env.DEV_NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) return appUrl.replace(/\/+$/, '')

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/+$/, '')

  return 'https://getoverlay.io'
}

function getInternalApiSecret(): string {
  const secret = process.env.INTERNAL_API_SECRET?.trim()
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is not configured')
  }
  return secret
}

export const runMinuteTick = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const runIds = await ctx.runMutation(internal.automations.claimDueRuns, {
      now: Date.now(),
      limit: 25,
    })

    for (const runId of runIds) {
      await ctx.scheduler.runAfter(0, internal.automationRunner.runAutomation, {
        runId,
      })
    }

    return null
  },
})

export const runAutomation = internalAction({
  args: {
    runId: v.id('automationRuns'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.automations.getRunForExecution, {
      runId: args.runId,
    })
    if (!payload) return null

    const { run, automation } = payload
    if (run.status !== 'queued') return null

    const now = Date.now()
    const turnId = `automation-${args.runId}-${now}`
    const conversationId = (automation.sourceConversationId || automation.conversationId) as
      | Id<'conversations'>
      | undefined
    await ctx.runMutation(internal.automations.markRunStarted, {
      runId: args.runId,
      conversationId,
      turnId,
      now,
    })

    try {
      const response = await fetch(`${getAutomationRunnerBaseUrl()}/api/app/automations/run`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-overlay-internal-secret': getInternalApiSecret(),
        },
        body: JSON.stringify({
          runId: args.runId,
          turnId,
          scheduledFor: run.scheduledFor,
          automation: {
            id: automation._id,
            userId: automation.userId,
            name: automation.name || automation.title || 'Untitled automation',
            description: automation.description || '',
            instructions: automation.instructions || automation.instructionsMarkdown || '',
            projectId: automation.projectId,
            modelId: automation.modelId,
            conversationId,
          },
        }),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Automation runner returned ${response.status}`)
      }

      const result = await response.json().catch(() => ({})) as { conversationId?: string }
      await ctx.runMutation(internal.automations.markRunCompleted, {
        runId: args.runId,
        conversationId: result.conversationId as Id<'conversations'> | undefined,
        now: Date.now(),
      })
    } catch (error) {
      await ctx.runMutation(internal.automations.markRunFailed, {
        runId: args.runId,
        error: summarizeError(error).slice(0, 1000),
        now: Date.now(),
      })
    }

    return null
  },
})
