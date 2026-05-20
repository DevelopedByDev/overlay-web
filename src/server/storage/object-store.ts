import 'server-only'

import { getOverlayServerContext } from '@/server/bootstrap'
import {
  getMaxPresignedUploadBytes,
  getR2PresignTtlSeconds,
  headObject,
  uploadBuffer,
} from '@/server/storage/r2'
export { keyForFile, keyForOutput } from '@/server/storage/storage-keys'

export async function generatePresignedUploadUrl(
  key: string,
  mimeType: string,
  sizeBytes: number,
  ttlSeconds?: number,
): Promise<string> {
  void sizeBytes
  void ttlSeconds
  return (await getOverlayServerContext().objectStore.getUploadUrl(key, mimeType)).url
}

export async function generatePresignedDownloadUrl(
  key: string,
  ttlSeconds?: number,
): Promise<string> {
  void ttlSeconds
  return getOverlayServerContext().objectStore.getDownloadUrl(key)
}

export async function deleteObject(key: string): Promise<void> {
  await getOverlayServerContext().objectStore.deleteObject(key)
}

export async function deleteObjects(keys: string[]): Promise<void> {
  for (const key of keys) {
    await deleteObject(key)
  }
}

export {
  getMaxPresignedUploadBytes,
  getR2PresignTtlSeconds,
  headObject,
  uploadBuffer,
}
