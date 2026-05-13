// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: File storage layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export interface IStorage {
  readonly providerId?: string
  init?(): Promise<void>
  health?(): Promise<{ ok: boolean; message?: string; latencyMs?: number }>
  shutdown?(): Promise<void>

  upload(key: string, data: Buffer | Uint8Array | string, contentType: string): Promise<string>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  deleteMany(keys: string[]): Promise<void>
  exists(key: string): Promise<boolean>
  head(key: string): Promise<{ sizeBytes: number; contentType?: string } | null>
  getPresignedUploadUrl(key: string, contentType: string, expiresSeconds?: number): Promise<string>
  getPresignedDownloadUrl(key: string, expiresSeconds?: number): Promise<string>
  getPresignedUrl(key: string, expiresSeconds: number): Promise<string>
  getPublicUrl(key: string): Promise<string | null>
  list(prefix: string): Promise<string[]>
}
