import { getStorageProvider } from '@/lib/provider-runtime'
export { keyForFile, keyForOutput } from './storage-keys'

const MAX_PRESIGN_TTL_SECONDS = 900

function getPresignTtl(ttlSeconds?: number): number {
  const configured = parseInt(process.env['R2_PRESIGN_TTL_SECONDS'] ?? String(MAX_PRESIGN_TTL_SECONDS), 10)
  const fallback = Math.min(Number.isFinite(configured) && configured > 0 ? configured : 300, MAX_PRESIGN_TTL_SECONDS)
  return Math.min(ttlSeconds ?? fallback, MAX_PRESIGN_TTL_SECONDS)
}

export async function generatePresignedUploadUrl(
  key: string,
  mimeType: string,
  ttlSeconds?: number,
): Promise<string> {
  const t0 = Date.now()
  const ttl = getPresignTtl(ttlSeconds)
  const url = await getStorageProvider().getPresignedUploadUrl(key, mimeType, ttl)
  console.log(`[Storage] generatePresignedUploadUrl provider=${getStorageProvider().providerId ?? 'unknown'} key=${key} mimeType=${mimeType} ttl=${ttl}s duration=${Date.now() - t0}ms`)
  return url
}

export async function generatePresignedDownloadUrl(
  key: string,
  ttlSeconds?: number,
): Promise<string> {
  const t0 = Date.now()
  const ttl = getPresignTtl(ttlSeconds)
  const url = await getStorageProvider().getPresignedDownloadUrl(key, ttl)
  console.log(`[Storage] generatePresignedDownloadUrl provider=${getStorageProvider().providerId ?? 'unknown'} key=${key} ttl=${ttl}s duration=${Date.now() - t0}ms`)
  return url
}

export async function uploadBuffer(
  key: string,
  body: Buffer | Uint8Array | string,
  mimeType: string,
): Promise<void> {
  const t0 = Date.now()
  const sizeBytes = typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength
  await getStorageProvider().upload(key, body, mimeType)
  console.log(`[Storage] uploadBuffer provider=${getStorageProvider().providerId ?? 'unknown'} key=${key} mimeType=${mimeType} size=${sizeBytes}B duration=${Date.now() - t0}ms`)
}

export async function deleteObject(key: string): Promise<void> {
  const t0 = Date.now()
  await getStorageProvider().delete(key)
  console.log(`[Storage] deleteObject provider=${getStorageProvider().providerId ?? 'unknown'} key=${key} duration=${Date.now() - t0}ms`)
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const t0 = Date.now()
  await getStorageProvider().deleteMany(keys)
  console.log(`[Storage] deleteObjects provider=${getStorageProvider().providerId ?? 'unknown'} count=${keys.length} duration=${Date.now() - t0}ms`)
}

export async function headObject(key: string): Promise<{ sizeBytes: number; contentType: string | undefined } | null> {
  const head = await getStorageProvider().head(key)
  return head ? { sizeBytes: head.sizeBytes, contentType: head.contentType } : null
}
