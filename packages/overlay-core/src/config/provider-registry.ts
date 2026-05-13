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
  | 'cache'
  | 'queue'
  | 'search'

export type ProviderId = OverlayConfig['providers'][ProviderDomain]

export type ProviderHealthStatus = 'ok' | 'degraded' | 'down'

export interface ProviderHealth {
  status: ProviderHealthStatus
  providerId: string
  domain: ProviderDomain
  message?: string
  latencyMs?: number
  checkedAt: number
}

export interface ProviderLifecycle {
  readonly providerId: string
  init?(): Promise<void>
  health?(): Promise<Partial<Omit<ProviderHealth, 'providerId' | 'domain' | 'checkedAt'>> & { ok?: boolean }>
  shutdown?(): Promise<void>
}

export type RegisteredProvider<T = unknown> = T & Partial<ProviderLifecycle>

export interface ProviderRegistry {
  get<T>(domain: ProviderDomain): T
  register<T>(domain: ProviderDomain, providerId: string, provider: RegisteredProvider<T>): void
  init(): Promise<void>
  health(): Promise<Record<ProviderDomain, ProviderHealth>>
  shutdown(): Promise<void>
}

export function createProviderRegistry(): ProviderRegistry {
  const store = new Map<ProviderDomain, { providerId: string; provider: RegisteredProvider }>()
  return {
    get<T>(domain: ProviderDomain): T {
      const entry = store.get(domain)
      if (!entry) throw new Error(`No provider registered for domain: ${domain}`)
      return entry.provider as T
    },
    register<T>(domain: ProviderDomain, providerId: string, provider: RegisteredProvider<T>): void {
      store.set(domain, { providerId, provider: provider as RegisteredProvider })
    },
    async init(): Promise<void> {
      for (const { provider } of store.values()) {
        await provider.init?.()
      }
    },
    async health(): Promise<Record<ProviderDomain, ProviderHealth>> {
      const entries = await Promise.all(
        Array.from(store.entries()).map(async ([domain, { providerId, provider }]) => {
          const start = Date.now()
          try {
            const result = await provider.health?.()
            return [
              domain,
              {
              status: result?.status ?? (result?.ok === false ? 'down' : 'ok'),
                providerId,
                domain,
                message: result?.message,
                latencyMs: result?.latencyMs ?? Date.now() - start,
                checkedAt: Date.now(),
              },
            ] as const
          } catch (error) {
            return [
              domain,
              {
                status: 'down',
                providerId,
                domain,
                message: error instanceof Error ? error.message : String(error),
                latencyMs: Date.now() - start,
                checkedAt: Date.now(),
              },
            ] as const
          }
        }),
      )

      return Object.fromEntries(entries) as Record<ProviderDomain, ProviderHealth>
    },
    async shutdown(): Promise<void> {
      for (const { provider } of Array.from(store.values()).reverse()) {
        await provider.shutdown?.()
      }
    },
  }
}
