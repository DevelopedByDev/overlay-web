import { NextRequest, NextResponse } from 'next/server'
import { BrowserUse } from 'browser-use-sdk/v3'
import type { ProxyCountryCode } from 'browser-use-sdk/v3'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { BROWSER_USE_TASK_INIT_USD, calculateBrowserUseV3TokenCost } from '@/lib/model-pricing'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import type { Entitlements } from '@/lib/app-contracts'
import {
  buildInsufficientCreditsPayload,
  billableBudgetCentsFromProviderUsd,
  ensureBudgetAvailable,
  getBudgetTotals,
  isPaidPlan,
} from '@/lib/billing-runtime'

export const maxDuration = 300

function parseUsd(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export async function POST(request: NextRequest) {
  try {
    const { task, sessionId, keepAlive, model, proxyCountryCode, accessToken, userId }: {
      task?: string
      sessionId?: string
      keepAlive?: boolean
      model?: 'bu-mini' | 'bu-max'
      proxyCountryCode?: string
      accessToken?: string
      userId?: string
    } = await request.json()

    const auth = await resolveAuthenticatedAppUser(request, { accessToken, userId })
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!task?.trim()) {
      return NextResponse.json({ error: 'Task is required' }, { status: 400 })
    }

    const apiKey = process.env.BROWSER_USE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'browser_use_not_configured', message: 'Browser Use is not configured on the server.' },
        { status: 500 },
      )
    }

    const serverSecret = getInternalApiSecret()
    const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
      serverSecret,
      userId: auth.userId,
    })

    if (!entitlements) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Could not verify subscription. Try signing out and back in.' },
        { status: 401 },
      )
    }

    let currentEntitlements = entitlements
    let budget = getBudgetTotals(currentEntitlements)
    const taskInitCents = billableBudgetCentsFromProviderUsd(BROWSER_USE_TASK_INIT_USD)

    if (!isPaidPlan(currentEntitlements)) {
      return NextResponse.json(
        { error: 'generation_not_allowed', message: 'Browser browsing requires a paid plan.' },
        { status: 403 },
      )
    }
    if (budget.remainingCents <= taskInitCents) {
      const autoTopUp = await ensureBudgetAvailable({
        userId: auth.userId,
        entitlements: currentEntitlements,
        minimumRequiredCents: taskInitCents + 1,
      })
      currentEntitlements = autoTopUp.entitlements
      budget = getBudgetTotals(currentEntitlements)
    }
    const remainingVariableBudgetUsd = Math.max(0, budget.remainingCents / 100 / 1.25 - BROWSER_USE_TASK_INIT_USD)
    if (budget.remainingCents <= taskInitCents || remainingVariableBudgetUsd <= 0) {
      return NextResponse.json(
        buildInsufficientCreditsPayload(currentEntitlements, 'Not enough budget remaining to start a browser task.'),
        { status: 402 },
      )
    }

    const client = new BrowserUse({ apiKey })
    const normalizedProxyCountryCode =
      typeof proxyCountryCode === 'string' && /^[a-z]{2}$/i.test(proxyCountryCode)
        ? (proxyCountryCode.toLowerCase() as ProxyCountryCode)
        : undefined
    const result = await client.run(task.trim(), {
      ...(sessionId ? { sessionId } : {}),
      ...(typeof keepAlive === 'boolean' ? { keepAlive } : {}),
      ...(model ? { model } : {}),
      ...(normalizedProxyCountryCode ? { proxyCountryCode: normalizedProxyCountryCode } : {}),
      maxCostUsd: remainingVariableBudgetUsd,
    })

    const llmCostUsd = parseUsd(result.llmCostUsd)
    const proxyCostUsd = parseUsd(result.proxyCostUsd)
    const browserCostUsd = parseUsd(result.browserCostUsd)
    const reportedVariableCostUsd = parseUsd(result.totalCostUsd)
    const estimatedVariableCostUsd =
      reportedVariableCostUsd > 0
        ? reportedVariableCostUsd
        : calculateBrowserUseV3TokenCost(
            result.model,
            result.totalInputTokens ?? 0,
            result.totalOutputTokens ?? 0,
          ) + proxyCostUsd + browserCostUsd
    const totalChargeUsd = BROWSER_USE_TASK_INIT_USD + estimatedVariableCostUsd
    const costCents = billableBudgetCentsFromProviderUsd(totalChargeUsd)

    await convex.mutation('usage:recordBatch', {
      serverSecret,
      userId: auth.userId,
      events: [{
        type: 'generation',
        modelId: `browser-use/${result.model}`,
        inputTokens: result.totalInputTokens ?? 0,
        outputTokens: result.totalOutputTokens ?? 0,
        cachedTokens: 0,
        cost: costCents,
        timestamp: Date.now(),
      }],
    })

    const updated = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
      serverSecret,
      userId: auth.userId,
    })

    return NextResponse.json({
      output: result.output,
      sessionId: result.id,
      liveUrl: result.liveUrl ?? null,
      status: result.status,
      costUsd: totalChargeUsd.toFixed(4),
      billing: {
        taskInitUsd: BROWSER_USE_TASK_INIT_USD.toFixed(4),
        variableUsd: estimatedVariableCostUsd.toFixed(4),
        llmUsd: llmCostUsd.toFixed(4),
        proxyUsd: proxyCostUsd.toFixed(4),
        browserUsd: browserCostUsd.toFixed(4),
        reportedTotalUsd: reportedVariableCostUsd.toFixed(4),
        billedCents: costCents,
        maxCostUsd: remainingVariableBudgetUsd.toFixed(4),
        remainingCreditsCents:
          updated
            ? (updated.budgetRemainingCents ?? updated.creditsTotal * 100 - updated.creditsUsed)
            : undefined,
      },
    })
  } catch (error) {
    console.error('[Browser Task API] Error:', error)
    const message = error instanceof Error ? error.message : 'Browser task failed'
    return NextResponse.json({ error: 'browser_task_failed', message }, { status: 500 })
  }
}
