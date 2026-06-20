import 'server-only'

import { logger } from '@/server/observability/logger'
import { calculateLanguageModelTokenCostOrNull } from '@/server/ai/gateway/live-model-pricing'
import { isPremiumModel } from '@/server/ai/pricing'
import { isByokModelId } from '@/shared/ai/gateway/byok-model-conversion'
import {
  billableBudgetCentsFromProviderUsd,
  finalizeProviderBudgetReservation,
  markProviderBudgetReconcile,
  releaseProviderBudgetReservation,
  reserveProviderBudget,
} from '@/server/billing/billing-runtime'
import { summarizeErrorForLog } from '@/shared/security/safe-log'
import type { Entitlements } from '@/shared/app/app-contracts'
import type { ActConversationRepository } from './ActConversationRepository'

export type ActBudgetFailure = {
  payload: Record<string, unknown>
  statusCode: number
}

export type ActBudgetReservationResult =
  | { ok: true; reservationId: string | null }
  | { ok: false; failure: ActBudgetFailure }

export class ActUsageBudgetService {
  constructor(private readonly deps: {
    repository: ActConversationRepository
  }) {}

  async reserveForAttempt(args: {
    entitlements: Entitlements
    estimatedInputTokens: number
    maxOutputTokens: number
    modelId: string
    paid: boolean
    userId: string
  }): Promise<ActBudgetReservationResult> {
    // BYOK models bypass Overlay billing — no budget reservation needed.
    if (isByokModelId(args.modelId)) return { ok: true, reservationId: null }
    if (!args.paid || !isPremiumModel(args.modelId)) return { ok: true, reservationId: null }
    const estimatedProviderCostUsd = await calculateLanguageModelTokenCostOrNull(
      args.modelId,
      args.estimatedInputTokens,
      0,
      args.maxOutputTokens,
    )
    if (estimatedProviderCostUsd === null) {
      return {
        ok: false,
        failure: {
          payload: {
            error: 'pricing_missing',
            message: `Model ${args.modelId} is not priced for production use.`,
          },
          statusCode: 400,
        },
      }
    }
    const reservation = await reserveProviderBudget({
      userId: args.userId,
      entitlements: args.entitlements,
      providerCostUsd: estimatedProviderCostUsd,
      kind: 'agent',
      modelId: args.modelId,
    })
    if (!reservation.ok) {
      return {
        ok: false,
        failure: {
          payload: { ...reservation.payload, error: reservation.code },
          statusCode: reservation.status,
        },
      }
    }
    return { ok: true, reservationId: reservation.reservationId }
  }

  async recordFinishedUsage(args: {
    forceFreeTierLimits: boolean
    inputTokens: number
    modelId: string
    outputTokens: number
    reservationId: string | null
    userId: string
  }): Promise<{ finalized: boolean; reservationId: string | null }> {
    // BYOK models bypass Overlay billing — record token counts with cost: 0
    // so usage is still visible in the dashboard without charging credits.
    if (isByokModelId(args.modelId)) {
      if (args.inputTokens <= 0 && args.outputTokens <= 0) {
        return { finalized: false, reservationId: args.reservationId }
      }
      const events = [{
        type: 'agent' as const,
        modelId: args.modelId,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        cachedTokens: 0,
        cost: 0,
        timestamp: Date.now(),
      }]
      try {
        await this.deps.repository.recordUsageBatch({
          userId: args.userId,
          forceFreeTierLimits: args.forceFreeTierLimits,
          events,
        })
      } catch (err) {
        logger.error('[conversations/act] Failed to record BYOK usage:', summarizeErrorForLog(err))
      }
      return { finalized: false, reservationId: null }
    }

    const providerCostUsd = await calculateLanguageModelTokenCostOrNull(
      args.modelId,
      args.inputTokens,
      0,
      args.outputTokens,
    )
    if (providerCostUsd === null) {
      logger.error('[conversations/act] Missing pricing for completed provider call', { modelId: args.modelId })
      if (args.reservationId) {
        await this.markReservationForReconcile({
          userId: args.userId,
          reservationId: args.reservationId,
          errorMessage: `pricing_missing:${args.modelId}`,
        }).catch((err) => logger.error('[conversations/act] Failed to mark reservation for reconcile:', summarizeErrorForLog(err)))
        return { finalized: false, reservationId: null }
      }
      return { finalized: false, reservationId: args.reservationId }
    }

    const costCents = billableBudgetCentsFromProviderUsd(providerCostUsd)
    if (costCents <= 0 && args.inputTokens <= 0 && args.outputTokens <= 0) {
      return { finalized: false, reservationId: args.reservationId }
    }

    const events = [{
      type: 'agent' as const,
      modelId: args.modelId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      cachedTokens: 0,
      cost: costCents,
      timestamp: Date.now(),
    }]

    try {
      if (args.reservationId) {
        await finalizeProviderBudgetReservation({
          userId: args.userId,
          reservationId: args.reservationId,
          actualProviderCostUsd: providerCostUsd,
          events,
        })
        return { finalized: true, reservationId: null }
      }
      await this.deps.repository.recordUsageBatch({
        userId: args.userId,
        forceFreeTierLimits: args.forceFreeTierLimits,
        events,
      })
      return { finalized: false, reservationId: null }
    } catch (err) {
      logger.error('[conversations/act] Failed to record usage:', summarizeErrorForLog(err))
      if (args.reservationId) {
        await this.markReservationForReconcile({
          userId: args.userId,
          reservationId: args.reservationId,
          errorMessage: summarizeErrorForLog(err),
        }).catch((reconcileErr) => logger.error('[conversations/act] Failed to mark reservation for reconcile:', summarizeErrorForLog(reconcileErr)))
        return { finalized: false, reservationId: null }
      }
      return { finalized: false, reservationId: args.reservationId }
    }
  }

  async releaseReservation(args: {
    reason?: string
    reservationId: string | null | undefined
    userId: string
  }): Promise<void> {
    if (!args.reservationId) return
    await releaseProviderBudgetReservation({
      userId: args.userId,
      reservationId: args.reservationId,
      reason: args.reason,
    })
  }

  async markReservationForReconcile(args: {
    errorMessage?: string
    reservationId: string | null | undefined
    userId: string
  }): Promise<void> {
    if (!args.reservationId) return
    await markProviderBudgetReconcile({
      userId: args.userId,
      reservationId: args.reservationId,
      errorMessage: args.errorMessage,
    })
  }
}
