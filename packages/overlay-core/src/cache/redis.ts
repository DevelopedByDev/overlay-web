import { Socket, createConnection } from 'node:net'
import { TLSSocket, connect as tlsConnect } from 'node:tls'
import type { ICache } from './interface'

export interface RedisCacheOptions {
  providerId?: 'redis' | 'valkey'
  url: string
}

export class RedisCache implements ICache {
  readonly providerId: string
  private readonly url: URL
  private socket: Socket | TLSSocket | null = null
  private buffer = Buffer.alloc(0)
  private queue: Array<{ resolve: (value: unknown) => void; reject: (error: Error) => void }> = []

  constructor(options: RedisCacheOptions) {
    this.providerId = options.providerId ?? 'redis'
    this.url = new URL(options.url)
  }

  async init(): Promise<void> {
    await this.command('PING')
  }

  async health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }> {
    const start = Date.now()
    const pong = await this.command('PING')
    return { ok: pong === 'PONG', latencyMs: Date.now() - start }
  }

  async shutdown(): Promise<void> {
    this.socket?.destroy()
    this.socket = null
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.command('GET', key)
    if (value == null) return null
    if (typeof value !== 'string') return value as T
    try {
      return JSON.parse(value) as T
    } catch {
      return value as T
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const encoded = typeof value === 'string' ? value : JSON.stringify(value)
    if (ttlSeconds) await this.command('SET', key, encoded, 'EX', String(ttlSeconds))
    else await this.command('SET', key, encoded)
  }

  async del(key: string): Promise<void> {
    await this.command('DEL', key)
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const value = Number(await this.command('INCR', key))
    if (value === 1 && ttlSeconds) await this.expire(key, ttlSeconds)
    return value
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.command('EXPIRE', key, String(ttlSeconds))
  }

  async ttl(key: string): Promise<number> {
    return Number(await this.command('TTL', key))
  }

  async flush(pattern: string): Promise<void> {
    let cursor = '0'
    do {
      const result = await this.command('SCAN', cursor, 'MATCH', pattern, 'COUNT', '100')
      if (!Array.isArray(result)) return
      cursor = String(result[0])
      const keys = Array.isArray(result[1]) ? result[1].map(String) : []
      if (keys.length > 0) await this.command('DEL', ...keys)
    } while (cursor !== '0')
  }

  private async command(...args: string[]): Promise<unknown> {
    await this.ensureConnected()
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject })
      this.socket!.write(encodeCommand(args))
    })
  }

  private async ensureConnected(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return
    const port = Number(this.url.port || (this.url.protocol === 'rediss:' ? 6380 : 6379))
    const host = this.url.hostname
    this.socket = this.url.protocol === 'rediss:'
      ? tlsConnect({ host, port })
      : createConnection({ host, port })
    this.socket.on('data', (chunk) => this.onData(chunk))
    this.socket.on('error', (error) => this.rejectAll(error))
    await new Promise<void>((resolve, reject) => {
      this.socket!.once('connect', resolve)
      this.socket!.once('error', reject)
    })
    if (this.url.password) await this.command('AUTH', decodeURIComponent(this.url.password))
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (this.queue.length > 0) {
      const parsed = parseReply(this.buffer)
      if (!parsed) return
      this.buffer = this.buffer.subarray(parsed.offset)
      const next = this.queue.shift()
      if (!next) return
      if (parsed.value instanceof Error) next.reject(parsed.value)
      else next.resolve(parsed.value)
    }
  }

  private rejectAll(error: Error): void {
    for (const item of this.queue.splice(0)) item.reject(error)
  }
}

function encodeCommand(args: string[]): string {
  return `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join('')}`
}

function parseReply(buffer: Buffer): { value: unknown; offset: number } | null {
  if (buffer.length === 0) return null
  const type = String.fromCharCode(buffer[0]!)
  const lineEnd = buffer.indexOf('\r\n')
  if (lineEnd === -1) return null
  const line = buffer.subarray(1, lineEnd).toString()
  if (type === '+') return { value: line, offset: lineEnd + 2 }
  if (type === '-') return { value: new Error(line), offset: lineEnd + 2 }
  if (type === ':') return { value: Number(line), offset: lineEnd + 2 }
  if (type === '$') {
    const length = Number(line)
    if (length === -1) return { value: null, offset: lineEnd + 2 }
    const end = lineEnd + 2 + length
    if (buffer.length < end + 2) return null
    return { value: buffer.subarray(lineEnd + 2, end).toString(), offset: end + 2 }
  }
  if (type === '*') {
    const count = Number(line)
    let offset = lineEnd + 2
    const values: unknown[] = []
    for (let i = 0; i < count; i++) {
      const parsed = parseReply(buffer.subarray(offset))
      if (!parsed) return null
      values.push(parsed.value)
      offset += parsed.offset
    }
    return { value: values, offset }
  }
  return { value: new Error(`Unsupported Redis reply type: ${type}`), offset: buffer.length }
}
