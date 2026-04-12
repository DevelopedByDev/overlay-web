'use node'

import { internal } from './_generated/api'
import { internalAction, type ActionCtx } from './_generated/server'
import { getAutomationExecutorBaseUrl } from '../src/lib/url'
import { AUTOMATION_TIMEOUT_MS } from '../src/lib/automation-guardrails'
import { buildServiceAuthToken, getServiceAuthHeaderName } from '../src/lib/service-auth'

const DEFAULT_BATCH_SIZE = 10
const DEFAULT_LEASE_MS = 15 * 60 * 1000

async function runMinuteTickHandler(
  ctx: ActionCtx,
): Promise<{ claimed: number; dispatched: number; failed: number }> {
  await ctx.runMutation(internal.automations.markTimedOutRunsInternal, {
    now: Date.now(),
    timeoutMs: AUTOMATION_TIMEOUT_MS,
  })

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
  let dispatched = 0
  let failed = 0

  for (const job of jobs) {
    try {
      const requestId = `automation-dispatch-${job.automationRunId}-${Date.now()}`
      const serviceAuthHeader = await buildServiceAuthToken({
        userId: job.userId,
        method: 'POST',
        path: '/api/internal/automations/execute',
      })
      await ctx.runMutation(internal.automations.markDispatchingInternal, {
        automationRunId: job.automationRunId,
        requestId,
      })
      const response = await fetch(`${baseUrl}/api/internal/automations/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [getServiceAuthHeaderName()]: serviceAuthHeader,
        },
        body: JSON.stringify({
          automationId: job.automationId,
          automationRunId: job.automationRunId,
          userId: job.userId,
          requestId,
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
