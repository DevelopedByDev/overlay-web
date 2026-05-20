import 'server-only'

import type { Entitlements } from '@overlay/app-core'

export function createFreeEntitlements(): Entitlements {
  return {
    tier: 'free',
    planKind: 'free',
    creditsUsed: 0,
    creditsTotal: 0,
    dailyUsage: { ask: 0, write: 0, agent: 0 },
    dailyLimits: { ask: 0, write: 0, agent: 0 },
  }
}
