import type { ICache } from './interface'

type Entry = {
  value: unknown
  expiresAt?: number
}

export class MemoryCache implements ICache {
  readonly providerId = 'memory'
  private readonly store = new Map<string, Entry>()

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    return { ok: true, latencyMs: 0 }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value as T
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const current = Number(await this.get<number>(key) ?? 0) + 1
    const existing = this.store.get(key)
    this.store.set(key, {
      value: current,
      expiresAt: existing?.expiresAt ?? (ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined),
    })
    return current
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.store.get(key)
    if (!entry) return
    entry.expiresAt = Date.now() + ttlSeconds * 1000
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry) return -2
    if (!entry.expiresAt) return -1
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000))
  }

  async flush(pattern: string): Promise<void> {
    const regex = globToRegex(pattern)
    for (const key of this.store.keys()) {
      if (regex.test(key)) this.store.delete(key)
    }
  }
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}
