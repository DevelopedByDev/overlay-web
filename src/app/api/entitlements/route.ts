import { NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getSession } from '@/lib/workos-auth'

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  limits: {
    askPerDay: number
    agentPerDay: number
    writePerDay: number
    tokenBudget: number
    transcriptionSecondsPerWeek: number
  }
  usage: {
    ask: number
    agent: number
    write: number
    tokenCostAccrued: number
    transcriptionSeconds: number
  }
  remaining: {
    ask: number
    agent: number
    write: number
    tokenBudget: number
    transcriptionSeconds: number
  }
  resetAt: number
  billingPeriodEnd?: number
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // Convex returns a different structure, so we need to transform it
    interface ConvexEntitlements {
      tier: 'free' | 'pro' | 'max'
      creditsUsed: number
      creditsTotal: number
      dailyUsage: { ask: number; write: number; agent: number }
      dailyLimits: { ask: number; write: number; agent: number }
      transcriptionSecondsUsed: number
      transcriptionSecondsLimit: number
      localTranscriptionEnabled: boolean
      resetAt: number
      billingPeriodEnd: string
      lastSyncedAt: number
    }

    const convexData = await convex.query<ConvexEntitlements>('usage:getEntitlements', {
      userId,
      accessToken: session.accessToken,
    })

    // Transform to the expected format or use defaults
    const tier = convexData?.tier || 'free'
    const dailyUsage = convexData?.dailyUsage || { ask: 0, write: 0, agent: 0 }
    const dailyLimits = convexData?.dailyLimits || { ask: 15, write: 15, agent: 15 }
    const creditsUsed = convexData?.creditsUsed || 0
    const creditsTotal = (convexData?.creditsTotal || 0) * 100 // Convex stores dollars, app uses cents
    const transcriptionSecondsUsed = convexData?.transcriptionSecondsUsed || 0
    const transcriptionSecondsLimit = convexData?.transcriptionSecondsLimit || 600

    const entitlements: Entitlements = {
      tier,
      status: 'active',
      limits: {
        askPerDay: dailyLimits.ask === Infinity ? 999999 : dailyLimits.ask,
        agentPerDay: dailyLimits.agent === Infinity ? 999999 : dailyLimits.agent,
        writePerDay: dailyLimits.write === Infinity ? 999999 : dailyLimits.write,
        tokenBudget: creditsTotal,
        transcriptionSecondsPerWeek: transcriptionSecondsLimit === Infinity ? 999999 : transcriptionSecondsLimit
      },
      usage: {
        ask: dailyUsage.ask,
        agent: dailyUsage.agent,
        write: dailyUsage.write,
        tokenCostAccrued: creditsUsed,
        transcriptionSeconds: transcriptionSecondsUsed
      },
      remaining: {
        ask: Math.max(0, (dailyLimits.ask === Infinity ? 999999 : dailyLimits.ask) - dailyUsage.ask),
        agent: Math.max(0, (dailyLimits.agent === Infinity ? 999999 : dailyLimits.agent) - dailyUsage.agent),
        write: Math.max(0, (dailyLimits.write === Infinity ? 999999 : dailyLimits.write) - dailyUsage.write),
        tokenBudget: Math.max(0, creditsTotal - creditsUsed),
        transcriptionSeconds: Math.max(0, (transcriptionSecondsLimit === Infinity ? 999999 : transcriptionSecondsLimit) - transcriptionSecondsUsed)
      },
      resetAt: convexData?.resetAt || Date.now() + 24 * 60 * 60 * 1000,
      billingPeriodEnd: convexData?.billingPeriodEnd ? new Date(convexData.billingPeriodEnd).getTime() / 1000 : undefined
    }

    return NextResponse.json(entitlements)
  } catch (error) {
    console.error('Entitlements error:', error)
    return NextResponse.json({ error: 'Failed to fetch entitlements' }, { status: 500 })
  }
}
