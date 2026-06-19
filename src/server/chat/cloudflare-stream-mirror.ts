import 'server-only'

import type { NextRequest } from 'next/server'
import {
  CHAT_STREAM_RELAY_HEADER,
  CHAT_STREAM_RELAY_SECRET_HEADER,
  CHAT_STREAM_RELAY_VALUE,
} from '@/server/chat/chat-stream-relay-auth'
import { logger } from '@/server/observability/logger'

const USER_ID_HEADER = 'x-overlay-auth-user-id'
const CONVERSATION_ID_HEADER = 'x-overlay-conversation-id'
const TURN_ID_HEADER = 'x-overlay-turn-id'
const VARIANT_INDEX_HEADER = 'x-overlay-variant-index'
const MESSAGE_ID_HEADER = 'x-overlay-generating-message-id'
const MODEL_ID_HEADER = 'x-overlay-model-id'
const MODE_HEADER = 'x-overlay-mode'

type MirrorFetchInit = RequestInit & {
  duplex?: 'half'
}

export type CloudflareStreamMirrorMetadata = {
  conversationId: string
  messageId?: string
  mode?: string
  modelId?: string
  requestId: string
  turnId: string
  userId: string
  variantIndex: number
}

function readEnv(value: string | undefined): string {
  return value?.trim() ?? ''
}

function headerValue(value: string | number | undefined): string {
  return String(value ?? '').trim().slice(0, 512)
}

export function resolveCloudflareStreamMirrorUrl(request: NextRequest): URL | null {
  const configured = readEnv(process.env.NEXT_PUBLIC_CHAT_STREAM_RELAY_URL)
  if (!configured) return null
  if (process.env.NODE_ENV === 'development' && readEnv(process.env.NEXT_PUBLIC_CHAT_STREAM_RELAY_LOCAL) !== 'true') {
    return null
  }
  try {
    const url = new URL(configured, request.nextUrl.origin)
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/ingest`
    url.search = ''
    return url
  } catch (_error) {
    return null
  }
}

export function canMirrorToCloudflareStream(request: NextRequest): boolean {
  return Boolean(resolveCloudflareStreamMirrorUrl(request) && readEnv(process.env.CHAT_STREAM_RELAY_SECRET))
}

export async function mirrorChatStreamToCloudflare(params: {
  metadata: CloudflareStreamMirrorMetadata
  request: NextRequest
  stream: ReadableStream<Uint8Array>
}): Promise<void> {
  const url = resolveCloudflareStreamMirrorUrl(params.request)
  const relaySecret = readEnv(process.env.CHAT_STREAM_RELAY_SECRET)
  if (!url || !relaySecret) {
    logger.warn('[chat-stream] cloudflare mirror skipped', {
      requestId: params.metadata.requestId,
      hasRelayUrl: Boolean(url),
      hasRelaySecret: Boolean(relaySecret),
    })
    return
  }

  const startedAt = performance.now()
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'x-request-id': params.metadata.requestId,
    [CHAT_STREAM_RELAY_HEADER]: CHAT_STREAM_RELAY_VALUE,
    [CHAT_STREAM_RELAY_SECRET_HEADER]: relaySecret,
    [USER_ID_HEADER]: headerValue(params.metadata.userId),
    [CONVERSATION_ID_HEADER]: headerValue(params.metadata.conversationId),
    [TURN_ID_HEADER]: headerValue(params.metadata.turnId),
    [VARIANT_INDEX_HEADER]: headerValue(params.metadata.variantIndex),
    [MESSAGE_ID_HEADER]: headerValue(params.metadata.messageId),
    [MODEL_ID_HEADER]: headerValue(params.metadata.modelId),
    [MODE_HEADER]: headerValue(params.metadata.mode),
  })

  const init: MirrorFetchInit = {
    method: 'POST',
    headers,
    body: params.stream,
    duplex: 'half',
  }
  const response = await fetch(url, init)
  if (!response.ok) {
    const errorText = (await response.text().catch((_error) => '')).slice(0, 500)
    throw new Error(errorText || `Cloudflare stream mirror failed with HTTP ${response.status}`)
  }

  logger.info('[chat-stream] cloudflare mirror complete', {
    requestId: params.metadata.requestId,
    conversationId: params.metadata.conversationId,
    turnId: params.metadata.turnId,
    variantIndex: params.metadata.variantIndex,
    elapsedMs: Math.round(performance.now() - startedAt),
  })
}
