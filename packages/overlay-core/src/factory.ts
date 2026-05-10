// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: App initialization (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type { OverlayConfig } from './config/overlay-config'
import type { IDatabase } from './db/interface'
import type { IAuth } from './auth/interface'
import type { IStorage } from './storage/interface'
import type { IAI } from './ai/interface'
import type { IBilling } from './billing/interface'
import type { IQueue } from './queue/interface'
import type { ISearch } from './search/interface'
import type { IAudit } from './audit/interface'

export interface ProviderInstances {
  database: IDatabase
  auth: IAuth
  storage: IStorage
  ai: IAI
  billing: IBilling
  queue: IQueue
  search: ISearch
  audit: IAudit
}

export function createProviders(_config: OverlayConfig): ProviderInstances {
  // Placeholder: will instantiate real providers in Phase 3
  // For now, this function is never called by production code.
  throw new Error(
    'createProviders is not yet implemented. Wait for Phase 3 (provider implementations).'
  )
}
