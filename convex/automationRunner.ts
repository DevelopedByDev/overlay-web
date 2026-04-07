'use node'

import { internal } from './_generated/api'
import { internalAction, type ActionCtx } from './_generated/server'
import { getAutomationExecutorBaseUrl } from '../src/lib/url'

const DEFAULT_BATCH_SIZE = 10
const DEFAULT_LEASE_MS = 15 * 60 * 1000

function getInternalApiSecret(): string {
  const secret = process.env.INTERNAL_API_SECRET?.trim()
  if (!secret) {
    throw new Error('INTERNAL_API_SECRET is not configured.')
  }
  return secret
}

async function runMinuteTickHandler(
  ctx: ActionCtx,
): Promise<{ claimed: number; dispatched: number; failed: number }> {
  const retryJobs = await ctx.runMutation(internal.automations.claimRetryRunsInternal, {
    now: Date.now(),
    batchSize: DEFAULT_BATCH_SIZE,
  })
  const scheduledJobs = await ctx.runMutation(internal.automations.claimDueRunsInternal, {
    now: Date.now(),
    batchSize: DEFAULT_BATCH_SIZE,
    leaseMs: DEFAULT_LEASE_MS,
  })
  const jobs = [...retryJobs, ...scheduledJobs].slice(0, DEFAULT_BATCH_SIZE * 2)

  if (!jobs.length) {
    return { claimed: 0, dispatched: 0, failed: 0 }
  }

  const baseUrl = getAutomationExecutorBaseUrl()
  const internalApiSecret = getInternalApiSecret()
  let dispatched = 0
  let failed = 0

  for (const job of jobs) {
    try {
      const response = await fetch(`${baseUrl}/api/internal/automations/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-secret': internalApiSecret,
        },
        body: JSON.stringify({
          automationId: job.automationId,
          automationRunId: job.automationRunId,
          userId: job.userId,
        }),
      })

      if (!response.ok) {
        failed += 1
        const message = await response.text().catch(() => 'Automation dispatch failed')
        await ctx.runMutation(internal.automations.markDispatchFailedInternal, {
          automationRunId: job.automationRunId,
          errorMessage: message || 'Automation dispatch failed',
        })
        continue
      }

      dispatched += 1
    } catch (error) {
      failed += 1
      await ctx.runMutation(internal.automations.markDispatchFailedInternal, {
        automationRunId: job.automationRunId,
        errorMessage: error instanceof Error ? error.message : 'Automation dispatch failed',
      })
    }
  }

  return {
    claimed: jobs.length,
    dispatched,
    failed,
  }
}

export const runMinuteTick = internalAction({
  args: {},
  handler: runMinuteTickHandler,
})
