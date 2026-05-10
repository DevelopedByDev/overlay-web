// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: File storage layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export interface IStorage {
  upload(key: string, data: Buffer, contentType: string): Promise<string>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getPresignedUrl(key: string, expiresSeconds: number): Promise<string>
  getPublicUrl(key: string): Promise<string | null>
  list(prefix: string): Promise<string[]>
}
