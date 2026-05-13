// @enterprise-future — cache provider contract.

export interface ICache {
  readonly providerId?: string
  init?(): Promise<void>
  health?(): Promise<{ ok: boolean; message?: string; latencyMs?: number }>
  shutdown?(): Promise<void>

  get<T = unknown>(key: string): Promise<T | null>
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
  incr(key: string, ttlSeconds?: number): Promise<number>
  expire(key: string, ttlSeconds: number): Promise<void>
  ttl(key: string): Promise<number>
  flush(pattern: string): Promise<void>
}
