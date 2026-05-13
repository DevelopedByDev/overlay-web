import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export const CHAT_STREAM_RELAY_HEADER = 'x-overlay-chat-stream-relay'
export const CHAT_STREAM_RELAY_SECRET_HEADER = 'x-overlay-chat-stream-secret'
export const CHAT_STREAM_RELAY_VALUE = 'cloudflare'

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function isVerifiedChatStreamRelayRequest(request: NextRequest): boolean {
  const expected = process.env.CHAT_STREAM_RELAY_SECRET?.trim()
  if (!expected) return false

  const relay = request.headers.get(CHAT_STREAM_RELAY_HEADER)?.trim()
  if (relay !== CHAT_STREAM_RELAY_VALUE) return false

  const provided = request.headers.get(CHAT_STREAM_RELAY_SECRET_HEADER)?.trim()
  if (!provided) return false

  return timingSafeStringEqual(provided, expected)
}
