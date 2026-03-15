/**
 * OpenRouter Service — direct fetch-based streaming, bypasses Vercel AI SDK
 * to avoid Responses API format issues with OpenRouter models.
 */

import { convex } from '@/lib/convex'

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

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://getoverlay.io',
      'X-Title': 'Overlay',
    },
    body: JSON.stringify({
      model: modelId,
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

        if (onFinish && fullText) {
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
