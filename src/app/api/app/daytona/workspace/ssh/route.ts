import { NextResponse } from 'next/server'
import {
  ensureWorkspaceSandbox,
  issueSshAccess,
  refreshWorkspaceActivity,
  startIfNeeded,
} from '@/lib/daytona'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { getSession } from '@/lib/workos-auth'
import type { DaytonaWorkspaceTier } from '@/lib/daytona-pricing'

const SSH_ACCESS_TTL_MINUTES = 30

interface Entitlements {
  tier: 'free' | 'pro' | 'max'
  creditsUsed: number
  creditsTotal: number
}

function isPaidTier(tier: Entitlements['tier']): tier is DaytonaWorkspaceTier {
  return tier === 'pro' || tier === 'max'
}

export async function POST() {
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
    return NextResponse.json(
      { error: 'terminal_not_allowed', message: 'Terminal access requires a Pro or Max subscription.' },
      { status: 403 },
    )
  }

  const creditsTotalCents = entitlements.creditsTotal * 100
  const remainingCents = creditsTotalCents - entitlements.creditsUsed
  if (remainingCents <= 0) {
    return NextResponse.json(
      { error: 'insufficient_credits', message: 'No credits remaining. Please top up your account.' },
      { status: 402 },
    )
  }

  try {
    let workspaceRun = await ensureWorkspaceSandbox({
      userId,
      tier: entitlements.tier,
    })
    workspaceRun = await startIfNeeded(workspaceRun)
    await refreshWorkspaceActivity(workspaceRun)

    const sshAccess = await issueSshAccess(workspaceRun, SSH_ACCESS_TTL_MINUTES)

    return NextResponse.json({
      sandboxId: workspaceRun.workspace.sandboxId,
      state: workspaceRun.workspace.state,
      expiresAt:
        sshAccess.expiresAt instanceof Date
          ? sshAccess.expiresAt.toISOString()
          : new Date(sshAccess.expiresAt).toISOString(),
      sshCommand: sshAccess.sshCommand,
      resourceProfile: workspaceRun.profile,
    })
  } catch (error) {
    console.error('[DaytonaWorkspaceSSH] Failed to issue SSH access:', error)
    return NextResponse.json(
      {
        error: 'terminal_access_failed',
        message: error instanceof Error ? error.message : 'Failed to issue SSH access.',
      },
      { status: 500 },
    )
  }
}
