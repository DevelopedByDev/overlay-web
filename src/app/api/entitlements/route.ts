import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  autoRefillEnabled: boolean
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
  refillCredits: number
  resetAt: number
  billingPeriodEnd?: number
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const entitlements = await convex.query<Entitlements>('usage:getEntitlements', { userId })

    if (!entitlements) {
      // Return default free tier entitlements
      return NextResponse.json({
        tier: 'free',
        status: 'active',
        autoRefillEnabled: false,
        limits: {
          askPerDay: 5,
          agentPerDay: 5,
          writePerDay: 5,
          tokenBudget: 0,
          transcriptionSecondsPerWeek: 600
        },
        usage: {
          ask: 0,
          agent: 0,
          write: 0,
          tokenCostAccrued: 0,
          transcriptionSeconds: 0
        },
        remaining: {
          ask: 5,
          agent: 5,
          write: 5,
          tokenBudget: 0,
          transcriptionSeconds: 600
        },
        refillCredits: 0,
        resetAt: Date.now() + 24 * 60 * 60 * 1000
      })
    }

    return NextResponse.json(entitlements)
  } catch (error) {
    console.error('Entitlements error:', error)
    return NextResponse.json({ error: 'Failed to fetch entitlements' }, { status: 500 })
  }
}
