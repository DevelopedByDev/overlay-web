import { convex } from '@/lib/convex'
import { shouldPersistToolInvocation, toolCostBucketForId } from './tool-buckets'

export function fireAndForgetRecordToolInvocation(args: {
  accessToken?: string
  serverSecret?: string
  userId: string
  toolName: string
  mode: 'ask' | 'act'
  modelId?: string
  conversationId?: string
  success: boolean
  durationMs?: number
  error?: unknown
}): void {
  const bucket = toolCostBucketForId(args.toolName)
  if (!shouldPersistToolInvocation(bucket)) return

  const errorMessage = args.success
    ? undefined
    : args.error instanceof Error
      ? args.error.message.slice(0, 2000)
      : String(args.error ?? '').slice(0, 2000)

  void convex.mutation(
    'usage:recordToolInvocation',
    {
      accessToken: args.accessToken,
      serverSecret: args.serverSecret,
      userId: args.userId,
      toolId: args.toolName,
      mode: args.mode,
      modelId: args.modelId,
      conversationId: args.conversationId,
      success: args.success,
      durationMs: args.durationMs,
      costBucket: bucket,
      errorMessage,
    },
    { background: true, suppressNetworkConsoleError: true },
  )
}
