import { NextRequest, NextResponse } from 'next/server'
import { BrowserUse } from 'browser-use-sdk/v3'
import type { ProxyCountryCode } from 'browser-use-sdk/v3'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { BROWSER_USE_TASK_INIT_USD, calculateBrowserUseV3TokenCost } from '@/lib/model-pricing'
import { getSession } from '@/lib/workos-auth'

export const maxDuration = 300

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
}

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
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { task, sessionId, keepAlive, model, proxyCountryCode }: {
      task?: string
      sessionId?: string
      keepAlive?: boolean
      model?: 'bu-mini' | 'bu-max'
      proxyCountryCode?: string
    } = await request.json()

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

    const userId = session.user.id
    const serverSecret = getInternalApiSecret()
    const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
      serverSecret,
      userId,
    })

    if (!entitlements) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Could not verify subscription. Try signing out and back in.' },
        { status: 401 },
      )
    }

    const creditsTotalCents = entitlements.creditsTotal * 100
    const remainingCents = creditsTotalCents - entitlements.creditsUsed
    const taskInitCents = Math.round(BROWSER_USE_TASK_INIT_USD * 100)
    const remainingVariableBudgetUsd = Math.max(0, (remainingCents - taskInitCents) / 100)

    if (entitlements.tier === 'free') {
      return NextResponse.json(
        { error: 'generation_not_allowed', message: 'Browser browsing requires a Pro subscription.' },
        { status: 403 },
      )
    }
    if (remainingCents <= taskInitCents || remainingVariableBudgetUsd <= 0) {
      return NextResponse.json(
        { error: 'insufficient_credits', message: 'Not enough credits remaining to start a browser task.' },
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
    const costCents = Math.round(totalChargeUsd * 100)

    await convex.mutation('usage:recordBatch', {
      serverSecret,
      userId,
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
      userId,
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
          updated ? updated.creditsTotal * 100 - updated.creditsUsed : undefined,
      },
    })
  } catch (error) {
    console.error('[Browser Task API] Error:', error)
    const message = error instanceof Error ? error.message : 'Browser task failed'
    return NextResponse.json({ error: 'browser_task_failed', message }, { status: 500 })
  }
}
