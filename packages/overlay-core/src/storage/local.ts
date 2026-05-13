// @enterprise-future — local filesystem storage provider for self-hosted deployments.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve, sep } from 'node:path'
import type { IStorage } from './interface'

export interface LocalStorageOptions {
  rootDir: string
  publicBasePath?: string
  signingSecret?: string
  presignTtlSeconds?: number
}

export class LocalStorage implements IStorage {
  readonly providerId = 'local'
  private readonly rootDir: string
  private readonly publicBasePath: string
  private readonly signingSecret: string
  private readonly presignTtlSeconds: number

  constructor(options: LocalStorageOptions) {
    this.rootDir = resolve(options.rootDir)
    this.publicBasePath = options.publicBasePath ?? '/api/storage/local'
    this.signingSecret = options.signingSecret ?? 'overlay-local-storage-dev-secret'
    this.presignTtlSeconds = options.presignTtlSeconds ?? 900
  }

  async init(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true })
  }

  async health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }> {
    const start = Date.now()
    await this.init()
    await stat(this.rootDir)
    return { ok: true, latencyMs: Date.now() - start }
  }

  async upload(key: string, data: Buffer | Uint8Array | string, _contentType = 'application/octet-stream'): Promise<string> {
    const path = this.pathForKey(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, data)
    return key
  }

  async download(key: string): Promise<Buffer> {
    return await readFile(this.pathForKey(key))
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathForKey(key), { force: true })
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)))
  }

  async exists(key: string): Promise<boolean> {
    return (await this.head(key)) !== null
  }

  async head(key: string): Promise<{ sizeBytes: number; contentType?: string } | null> {
    try {
      const info = await stat(this.pathForKey(key))
      return { sizeBytes: info.size }
    } catch (error) {
      if ((error as { code?: string })?.code === 'ENOENT') return null
      throw error
    }
  }

  async getPresignedUploadUrl(key: string, _contentType: string, expiresSeconds?: number): Promise<string> {
    return this.signedUrl(key, 'put', expiresSeconds)
  }

  async getPresignedDownloadUrl(key: string, expiresSeconds?: number): Promise<string> {
    return this.signedUrl(key, 'get', expiresSeconds)
  }

  getPresignedUrl(key: string, expiresSeconds: number): Promise<string> {
    return this.getPresignedDownloadUrl(key, expiresSeconds)
  }

  async getPublicUrl(key: string): Promise<string | null> {
    return this.signedUrl(key, 'get', this.presignTtlSeconds)
  }

  async list(prefix: string): Promise<string[]> {
    const base = this.pathForKey(prefix || '.')
    const out: string[] = []
    await this.walk(base, out)
    return out.map((path) => path.slice(this.rootDir.length + 1).split(sep).join('/'))
  }

  verifySignedUrl(url: URL): { key: string; method: 'get' | 'put' } | null {
    const key = url.searchParams.get('key') ?? ''
    const method = url.searchParams.get('method') as 'get' | 'put' | null
    const expires = Number(url.searchParams.get('expires') ?? 0)
    const signature = url.searchParams.get('signature') ?? ''
    if (!key || (method !== 'get' && method !== 'put') || !Number.isFinite(expires) || expires < Date.now()) return null
    const expected = this.sign(key, method, expires)
    const left = Buffer.from(signature)
    const right = Buffer.from(expected)
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null
    return { key, method }
  }

  private signedUrl(key: string, method: 'get' | 'put', expiresSeconds?: number): string {
    const expires = Date.now() + (expiresSeconds ?? this.presignTtlSeconds) * 1000
    const params = new URLSearchParams({
      key,
      method,
      expires: String(expires),
      signature: this.sign(key, method, expires),
    })
    return `${this.publicBasePath}?${params.toString()}`
  }

  private sign(key: string, method: 'get' | 'put', expires: number): string {
    return createHmac('sha256', this.signingSecret).update(`${method}\n${expires}\n${key}`).digest('hex')
  }

  private pathForKey(key: string): string {
    const normalized = normalize(key).replace(/^(\.\.(\/|\\|$))+/, '')
    const full = resolve(join(this.rootDir, normalized))
    if (full !== this.rootDir && !full.startsWith(`${this.rootDir}${sep}`)) {
      throw new Error('Storage key escapes local storage root.')
    }
    return full
  }

  private async walk(path: string, out: string[]): Promise<void> {
    let info
    try {
      info = await stat(path)
    } catch (error) {
      if ((error as { code?: string })?.code === 'ENOENT') return
      throw error
    }
    if (info.isFile()) {
      out.push(path)
      return
    }
    if (!info.isDirectory()) return
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(path)
    await Promise.all(entries.map((entry) => this.walk(join(path, entry), out)))
  }
}
