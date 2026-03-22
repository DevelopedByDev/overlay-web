/**
 * OpenRouter Service — direct fetch to https://openrouter.ai/api/v1/chat/completions.
 * Overlay ids use `openrouter/` for our registry. Vendor models map to API slugs without that
 * prefix (e.g. `openrouter/arcee-ai/...` → `arcee-ai/...`). OpenRouter-native routers keep the
 * full id (e.g. `openrouter/free` — sending `free` alone is invalid).
 */

import type { UIMessage } from 'ai'
import { convex } from '@/lib/convex'

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const OPENROUTER_RETRY_ATTEMPTS = 7

/**
 * Retries 429/503 from OpenRouter (common with `openrouter/free` when upstream free models throttle).
 * The AI SDK also retries ~3 times; this layers longer backoff at the HTTP level per attempt.
 */
export async function openRouterFetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let last: Response | undefined
  for (let attempt = 0; attempt < OPENROUTER_RETRY_ATTEMPTS; attempt++) {
    const res = await fetch(input, init)
    last = res
    if (res.status !== 429 && res.status !== 503) {
      return res
    }
    await res.arrayBuffer().catch(() => {})
    if (attempt >= OPENROUTER_RETRY_ATTEMPTS - 1) {
      return res
    }
    const ra = res.headers.get('retry-after')
    let ms = Math.min(45_000, 1000 * 2 ** attempt)
    if (ra) {
      const sec = Number(ra)
      if (!Number.isNaN(sec)) {
        ms = Math.min(60_000, Math.max(500, sec * 1000))
      }
    }
    await new Promise((r) => setTimeout(r, ms))
  }
  return last!
}

function gatherErrorText(error: unknown, depth = 0): string {
  if (depth > 6 || error == null) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    const e = error as Error & { cause?: unknown; lastError?: unknown; errors?: unknown[] }
    let s = e.message
    if (e.cause) s += ' ' + gatherErrorText(e.cause, depth + 1)
    if (e.lastError) s += ' ' + gatherErrorText(e.lastError, depth + 1)
    if (Array.isArray(e.errors)) {
      for (const x of e.errors) s += ' ' + gatherErrorText(x, depth + 1)
    }
    return s
  }
  return String(error)
}

/** User-visible copy when OpenRouter / free pool fails. */
export function userFacingOpenRouterError(error: unknown): string {
  const raw = gatherErrorText(error)
  const lower = raw.toLowerCase()
  if (
    /\b429\b/.test(raw) ||
    lower.includes('rate limit') ||
    lower.includes('rate-limited') ||
    lower.includes('temporarily rate-limited')
  ) {
    return (
      'OpenRouter’s free models are temporarily rate-limited. Wait a minute and retry, ' +
      'or pick a specific free model (e.g. Trinity Large) instead of Free Router.'
    )
  }
  if (!raw.trim()) return 'Something went wrong. Please try again.'
  return raw.length > 600 ? `${raw.slice(0, 600)}…` : raw
}

/** Map overlay registry id → OpenRouter `model` string for /v1/chat/completions. */
export function toOpenRouterApiModelId(overlayModelId: string): string {
  if (!overlayModelId.startsWith('openrouter/')) {
    return overlayModelId
  }
  const rest = overlayModelId.slice('openrouter/'.length)
  // Vendor paths are `org/model` or `org/model:variant` — drop the registry prefix only for those.
  // Single-segment ids (`free`, `hunter-alpha`, …) are OpenRouter routers; API requires `openrouter/...`.
  if (rest.includes('/')) {
    return rest
  }
  return overlayModelId
}

export function buildOpenRouterMessagesFromUi(
  messages: UIMessage[],
  system: string
): OpenRouterMessage[] {
  const out: OpenRouterMessage[] = []
  const sys = system.trim()
  if (sys) {
    out.push({ role: 'system', content: sys })
  }
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    const parts = m.parts ?? []
    const textParts = parts.filter((p) => p.type === 'text')
    const hasFile = parts.some((p) => p.type === 'file')
    let content = textParts
      .map((p) => ('text' in p && typeof p.text === 'string' ? p.text : ''))
      .join('\n')
    if (hasFile && m.role === 'user') {
      content = content
        ? `${content}\n\n[User attached file(s) — describe or acknowledge as needed]`
        : '[User attached file(s)]'
    }
    if (!content.trim() && m.role === 'user') {
      content = '(empty message)'
    }
    if (m.role === 'assistant' && !content.trim()) continue
    out.push({ role: m.role, content })
  }
  return out
}

interface APIKeyResponse {
  key: string | null
}

async function resolveApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    try {
      const result = await convex.action<APIKeyResponse>('keys:getAPIKey', {
        provider: 'openrouter',
        accessToken,
      })
      if (result?.key) return result.key
    } catch (error) {
      console.error('[OpenRouter] Failed to fetch key from Convex:', error)
    }
  }
  return process.env.OPENROUTER_API_KEY ?? null
}

export async function streamOpenRouterChat({
  modelId,
  messages,
  accessToken,
  onFinish,
}: {
  modelId: string
  messages: OpenRouterMessage[]
  accessToken?: string
  onFinish?: (text: string, usage: { inputTokens: number; outputTokens: number }) => Promise<void>
}): Promise<Response> {
  const apiKey = await resolveApiKey(accessToken)
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY or configure it in Convex.')
  }

  const response = await openRouterFetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://getoverlay.io',
      'X-Title': 'Overlay',
    },
    body: JSON.stringify({
      model: toOpenRouterApiModelId(modelId),
      messages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter ${response.status}: ${errorText}`)
  }

  // Encode stream in Vercel AI SDK UIMessageStream format so useChat can parse it
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const messageId = `msg_${Date.now()}`
  let fullText = ''
  let inputTokens = 0
  let outputTokens = 0

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Message start
      controller.enqueue(encoder.encode(`f:${JSON.stringify({ messageId })}\n`))

      const reader = response.body!.getReader()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullText += content
                controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`))
              }
              if (parsed.usage) {
                inputTokens = parsed.usage.prompt_tokens ?? 0
                outputTokens = parsed.usage.completion_tokens ?? 0
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }

        // Finish parts
        const usage = { inputTokens, outputTokens }
        controller.enqueue(
          encoder.encode(`e:${JSON.stringify({ finishReason: 'stop', usage, isContinued: false })}\n`)
        )
        controller.enqueue(
          encoder.encode(`d:${JSON.stringify({ finishReason: 'stop', usage })}\n`)
        )
        controller.close()

        if (onFinish) {
          await onFinish(fullText, usage)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[OpenRouter] Stream error:', msg)
        controller.enqueue(encoder.encode(`3:${JSON.stringify(msg)}\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
      'Cache-Control': 'no-cache',
    },
  })
}
