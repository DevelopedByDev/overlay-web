// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Provider factory (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type { OverlayConfig } from './overlay-config'

export type ProviderDomain =
  | 'database'
  | 'auth'
  | 'storage'
  | 'aiGateway'
  | 'billing'
  | 'queue'
  | 'search'

export type ProviderId = OverlayConfig['providers'][ProviderDomain]

export interface ProviderRegistry {
  get<T>(domain: ProviderDomain): T
  register<T>(domain: ProviderDomain, provider: T): void
}

export function createProviderRegistry(): ProviderRegistry {
  const store = new Map<ProviderDomain, unknown>()
  return {
    get<T>(domain: ProviderDomain): T {
      const provider = store.get(domain)
      if (!provider) throw new Error(`No provider registered for domain: ${domain}`)
      return provider as T
    },
    register<T>(domain: ProviderDomain, provider: T): void {
      store.set(domain, provider)
    },
  }
}
