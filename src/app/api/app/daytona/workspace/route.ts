import { NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import {
  ensureWorkspaceSandbox,
  type DaytonaWorkspaceRecord,
} from '@/lib/daytona'
import {
  getDaytonaResourceProfile,
  type DaytonaWorkspaceState,
  type DaytonaWorkspaceTier,
} from '@/lib/daytona-pricing'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { getSession } from '@/lib/workos-auth'

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
}

function isPaidTier(tier: Entitlements['tier']): tier is DaytonaWorkspaceTier {
  return tier === 'pro' || tier === 'max'
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const serverSecret = getInternalApiSecret()
  const entitlements = await convex.query<Entitlements>('usage:getEntitlementsByServer', {
    userId,
    serverSecret,
  })

  if (!entitlements) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Could not verify subscription. Try signing out and back in.' },
      { status: 401 },
    )
  }

  if (!isPaidTier(entitlements.tier)) {
    return NextResponse.json({
      hasAccess: false,
      tier: 'free',
      state: 'missing' satisfies DaytonaWorkspaceState,
      canStart: false,
      canSsh: false,
    })
  }

  const creditsTotalCents = entitlements.creditsTotal * 100
  const creditsExhausted = creditsTotalCents > 0 && entitlements.creditsUsed >= creditsTotalCents
  const resourceProfile = getDaytonaResourceProfile(entitlements.tier)
  const storedWorkspace = await convex.query<DaytonaWorkspaceRecord | null>(
    'daytona:getWorkspaceByUserId',
    {
      userId,
      serverSecret,
    },
    { throwOnError: true },
  )

  if (!storedWorkspace) {
    return NextResponse.json({
      hasAccess: true,
      tier: entitlements.tier,
      state: 'missing' satisfies DaytonaWorkspaceState,
      canStart: !creditsExhausted,
      canSsh: false,
      resourceProfile,
    })
  }

  try {
    const ensured = await ensureWorkspaceSandbox({
      userId,
      tier: entitlements.tier,
    })

    return NextResponse.json({
      hasAccess: true,
      tier: entitlements.tier,
      state: ensured.workspace.state,
      sandboxId: ensured.workspace.sandboxId,
      canStart: !creditsExhausted,
      canSsh: !creditsExhausted && ensured.workspace.state === 'started',
      resourceProfile: ensured.profile,
    })
  } catch (error) {
    console.error('[DaytonaWorkspace] Failed to refresh workspace status:', error)
    return NextResponse.json({
      hasAccess: true,
      tier: entitlements.tier,
      state: storedWorkspace.state,
      sandboxId: storedWorkspace.sandboxId,
      canStart: !creditsExhausted,
      canSsh: !creditsExhausted && storedWorkspace.state === 'started',
      resourceProfile,
    })
  }
}
