import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText } from 'ai'
import { NextRequest } from 'next/server'

// In-memory per-IP rate limit: max 10 requests per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in a minute.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Demo unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages } = await req.json()
  const trimmedMessages = Array.isArray(messages) ? messages.slice(-8) : []

  const openrouter = createOpenRouter({
    apiKey,
    headers: {
      'HTTP-Referer': 'https://getoverlay.io',
      'X-Title': 'Overlay Demo',
    },
  })

  const result = streamText({
    model: openrouter.chat('meta-llama/llama-3.2-3b-instruct:free'),
    system: 'You are a helpful AI assistant. Be concise and friendly.',
    messages: trimmedMessages,
  })

  return result.toDataStreamResponse()
}
