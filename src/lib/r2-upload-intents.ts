import type { Id } from '../../convex/_generated/dataModel'
import { convex } from '@/lib/convex'
import { deleteObjects } from '@/lib/r2'
import { isOwnedFileR2Key } from '@/lib/storage-keys'

type ExpiredUploadIntent = {
  _id: Id<'r2UploadIntents'>
  r2Key: string
}

export type R2UploadIntent = {
  _id: Id<'r2UploadIntents'>
  declaredSizeBytes: number
  mimeType?: string
  expiresAt: number
}

export async function cleanupExpiredR2UploadIntents(params: {
  userId: string
  serverSecret: string
  limit?: number
}): Promise<number> {
  const expired = await convex.query<ExpiredUploadIntent[]>('files:listExpiredUploadIntentsByServer', {
    userId: params.userId,
    serverSecret: params.serverSecret,
    now: Date.now(),
    limit: params.limit ?? 25,
  }, { throwOnError: true })

  const safeExpired = (expired ?? []).filter((intent) => isOwnedFileR2Key(params.userId, intent.r2Key))
  if (safeExpired.length === 0) return 0

  await deleteObjects(safeExpired.map((intent) => intent.r2Key))
  await convex.mutation('files:expireUploadIntentsByServer', {
    userId: params.userId,
    serverSecret: params.serverSecret,
    intentIds: safeExpired.map((intent) => intent._id),
    now: Date.now(),
  }, { throwOnError: true })
  return safeExpired.length
}

export async function expireR2UploadIntent(params: {
  userId: string
  serverSecret: string
  intentId: Id<'r2UploadIntents'>
}): Promise<void> {
  await convex.mutation('files:expireUploadIntentsByServer', {
    userId: params.userId,
    serverSecret: params.serverSecret,
    intentIds: [params.intentId],
    now: Date.now(),
  }, { throwOnError: true })
}
