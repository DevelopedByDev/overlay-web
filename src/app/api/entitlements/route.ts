import { NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { logAuthDebug, summarizeSessionForLog } from '@/lib/auth-debug'
import { getTopUpPreferenceSnapshot } from '@/lib/billing-runtime'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  planKind: 'free' | 'paid'
  planAmountCents: number
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  autoTopUpEnabled: boolean
  topUpAmountCents: number
  autoTopUpAmountCents: number
  autoTopUpConsentGranted: boolean
  budgetUsedCents: number
  budgetTotalCents: number
  budgetRemainingCents: number
  creditsUsed: number
  creditsTotal: number
  limits: {
    askPerDay: number
    agentPerDay: number
    writePerDay: number
    tokenBudget: number
    transcriptionSecondsPerWeek: number
    overlayStorageBytes: number
  }
  usage: {
    ask: number
    agent: number
    write: number
    tokenCostAccrued: number
    transcriptionSeconds: number
    overlayStorageBytes: number
  }
  remaining: {
    ask: number
    agent: number
    write: number
    tokenBudget: number
    transcriptionSeconds: number
    overlayStorageBytes: number
  }
  resetAt: number
  billingPeriodEnd?: number
  dailyUsage: { ask: number; write: number; agent: number }
  dailyLimits: { ask: number; write: number; agent: number }
  overlayStorageBytesUsed: number
  overlayStorageBytesLimit: number
  transcriptionSecondsUsed: number
  transcriptionSecondsLimit: number
  localTranscriptionEnabled: boolean
  lastSyncedAt: number
}

function normalizeLimitValue(value: number | string): number {
  if (value === Infinity || value === 'Infinity') {
    return 999999
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET() {
  try {
    const session = await getSession()
    logAuthDebug('/api/entitlements getSession result', summarizeSessionForLog(session))
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // Convex returns a different structure, so we need to transform it
    interface ConvexEntitlements {
      tier: 'free' | 'pro' | 'max'
      planKind: 'free' | 'paid'
      planAmountCents: number
      budgetUsedCents: number
      budgetTotalCents: number
      budgetRemainingCents: number
      autoTopUpEnabled: boolean
      autoTopUpAmountCents: number
      autoTopUpConsentGranted: boolean
      creditsUsed: number
      creditsTotal: number
      dailyUsage: { ask: number; write: number; agent: number }
      dailyLimits: { ask: number; write: number; agent: number }
      transcriptionSecondsUsed: number
      transcriptionSecondsLimit: number
      localTranscriptionEnabled: boolean
      overlayStorageBytesUsed: number
      overlayStorageBytesLimit: number
      resetAt: number
      billingPeriodEnd: string
      lastSyncedAt: number
    }

    const fetchConvexEntitlements = async (userId: string) =>
      await convex.query<ConvexEntitlements>(
        'usage:getEntitlementsByServer',
        {
          userId,
          serverSecret: getInternalApiSecret(),
        },
        { throwOnError: true },
      )

    let convexData: ConvexEntitlements
    try {
      logAuthDebug('/api/entitlements first attempt start', {
        userId,
        session: summarizeSessionForLog(session),
      })
      const result = await fetchConvexEntitlements(userId)
      if (!result) {
        return NextResponse.json(
          { error: 'Failed to load subscription' },
          { status: 502 },
        )
      }
      convexData = result
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logAuthDebug('/api/entitlements first attempt error', {
        userId,
        error: msg,
        session: summarizeSessionForLog(session),
      })
      console.error('Entitlements error:', error)
      return NextResponse.json({ error: 'Failed to fetch entitlements' }, { status: 500 })
    }

    // Transform Convex shape — never guess "free" on auth/backend failure (handled above).
    const tier = convexData.tier
    const planKind = convexData.planKind
    const dailyUsage = convexData.dailyUsage
    const dailyLimits = convexData.dailyLimits
    const creditsUsed = convexData.budgetUsedCents ?? convexData.creditsUsed
    const creditsTotal = convexData.budgetTotalCents ?? convexData.creditsTotal * 100
    const transcriptionSecondsUsed = convexData.transcriptionSecondsUsed
    const transcriptionSecondsLimit = convexData.transcriptionSecondsLimit
    const overlayStorageBytesUsed = convexData.overlayStorageBytesUsed
    const overlayStorageBytesLimit = convexData.overlayStorageBytesLimit
    const askPerDay = normalizeLimitValue(dailyLimits.ask)
    const agentPerDay = normalizeLimitValue(dailyLimits.agent)
    const writePerDay = normalizeLimitValue(dailyLimits.write)
    const transcriptionSecondsPerWeek = normalizeLimitValue(transcriptionSecondsLimit)

    const entitlements: Entitlements = {
      tier,
      planKind,
      planAmountCents: convexData.planAmountCents,
      status: 'active',
      ...getTopUpPreferenceSnapshot(convexData),
      autoTopUpConsentGranted: convexData.autoTopUpConsentGranted,
      limits: {
        askPerDay,
        agentPerDay,
        writePerDay,
        tokenBudget: creditsTotal,
        transcriptionSecondsPerWeek,
        overlayStorageBytes: overlayStorageBytesLimit,
      },
      usage: {
        ask: dailyUsage.ask,
        agent: dailyUsage.agent,
        write: dailyUsage.write,
        tokenCostAccrued: creditsUsed,
        transcriptionSeconds: transcriptionSecondsUsed,
        overlayStorageBytes: overlayStorageBytesUsed,
      },
      remaining: {
        ask: Math.max(0, askPerDay - dailyUsage.ask),
        agent: Math.max(0, agentPerDay - dailyUsage.agent),
        write: Math.max(0, writePerDay - dailyUsage.write),
        tokenBudget: Math.max(0, creditsTotal - creditsUsed),
        transcriptionSeconds: Math.max(0, transcriptionSecondsPerWeek - transcriptionSecondsUsed),
        overlayStorageBytes: Math.max(0, overlayStorageBytesLimit - overlayStorageBytesUsed),
      },
      budgetUsedCents: creditsUsed,
      budgetTotalCents: creditsTotal,
      budgetRemainingCents: convexData.budgetRemainingCents ?? Math.max(0, creditsTotal - creditsUsed),
      creditsUsed,
      creditsTotal: creditsTotal / 100,
      dailyUsage,
      dailyLimits,
      overlayStorageBytesUsed,
      overlayStorageBytesLimit,
      transcriptionSecondsUsed,
      transcriptionSecondsLimit,
      localTranscriptionEnabled: convexData.localTranscriptionEnabled,
      resetAt: convexData.resetAt,
      billingPeriodEnd: convexData.billingPeriodEnd
        ? new Date(convexData.billingPeriodEnd).getTime() / 1000
        : undefined,
      lastSyncedAt: convexData.lastSyncedAt,
    }

    logAuthDebug('/api/entitlements success', {
      userId,
      tier: entitlements.tier,
    })

    return NextResponse.json(entitlements)
  } catch (error) {
    logAuthDebug('/api/entitlements outer error', {
      error: error instanceof Error ? error.message : String(error),
    })
    console.error('Entitlements error:', error)
    return NextResponse.json({ error: 'Failed to fetch entitlements' }, { status: 500 })
  }
}
