import { createGateway, generateText, stepCountIs, tool } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import { getModel } from '@/lib/models'
import { openRouterFetchWithRetry, toOpenRouterApiModelId } from '@/lib/openrouter-service'
import { getServerProviderKey } from '@/lib/server-provider-keys'

let cachedGateway: ReturnType<typeof createGateway> | null = null
let cachedApiKey: string | null = null

async function resolveGatewayApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    const serverKey = await getServerProviderKey('ai_gateway')
    if (serverKey) {
      return serverKey
    }
  }

  return process.env.AI_GATEWAY_API_KEY ?? null
}

async function resolveOpenRouterApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    const serverKey = await getServerProviderKey('openrouter')
    if (serverKey) {
      return serverKey
    }
  }
  return process.env.OPENROUTER_API_KEY ?? null
}

export function getGatewayModelId(modelId: string): string {
  const model = getModel(modelId)
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`)
  }

  if (model.id.includes('/')) {
    return model.id
  }

  return `${model.provider}/${model.id}`
}

export async function getOpenRouterLanguageModel(modelId: string, accessToken?: string) {
  const apiKey = await resolveOpenRouterApiKey(accessToken)
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. Set it in Convex or the server environment.'
    )
  }

  // Official OpenRouter AI SDK provider — chat() uses /v1/chat/completions (tool + stream compatible).
  // See https://openrouter.ai/docs/guides/community/vercel-ai-sdk
  const openrouter = createOpenRouter({
    apiKey,
    compatibility: 'strict',
    headers: {
      'HTTP-Referer': 'https://getoverlay.io',
      'X-Title': 'Overlay',
    },
    fetch: openRouterFetchWithRetry,
  })

  return openrouter.chat(toOpenRouterApiModelId(modelId))
}

/**
 * Like {@link getOpenRouterLanguageModel} but also captures the actual model OpenRouter routes to
 * (for `openrouter/free` the router picks a free model at runtime). The `onModelCaptured` callback
 * is invoked as soon as the first SSE chunk with a `model` field arrives, so it is always set
 * before `ToolLoopAgent.onFinish` is called.
 */
export async function getOpenRouterLanguageModelCapturingRoutedModel(
  modelId: string,
  accessToken: string | undefined,
  onModelCaptured: (model: string) => void,
) {
  const apiKey = await resolveOpenRouterApiKey(accessToken)
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. Set it in Convex or the server environment.'
    )
  }

  const captureFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await openRouterFetchWithRetry(url, init)
    if (!response.body) return response
    const [primary, capture] = response.body.tee()
    ;(async () => {
      const reader = capture.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          let stop = false
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') { stop = true; break }
            try {
              const chunk = JSON.parse(data) as { model?: string }
              if (typeof chunk.model === 'string' && chunk.model) {
                onModelCaptured(chunk.model)
                stop = true
                break
              }
            } catch { /* ignore parse errors */ }
          }
          if (stop) break
        }
      } catch { /* ignore read errors */ } finally {
        reader.cancel().catch(() => {})
      }
    })()
    return new Response(primary, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }

  const openrouter = createOpenRouter({
    apiKey,
    compatibility: 'strict',
    headers: {
      'HTTP-Referer': 'https://getoverlay.io',
      'X-Title': 'Overlay',
    },
    fetch: captureFetch,
  })
  return openrouter.chat(toOpenRouterApiModelId(modelId))
}

export async function getGatewayLanguageModel(modelId: string, accessToken?: string) {
  const model = getModel(modelId)

  // Route OpenRouter models to OpenRouter API
  if (model?.provider === 'openrouter') {
    return getOpenRouterLanguageModel(modelId, accessToken)
  }

  // Alibaba Qwen ids match OpenRouter (e.g. qwen/qwen3.6-plus); AI Gateway often has no route for them.
  if (model?.provider === 'alibaba') {
    return getOpenRouterLanguageModel(modelId, accessToken)
  }

  // Z.ai GLM ids (e.g. z-ai/glm-5.1) are on OpenRouter; Vercel AI Gateway may 404 model_not_found.
  if (model?.provider === 'zai') {
    return getOpenRouterLanguageModel(modelId, accessToken)
  }

  const apiKey = await resolveGatewayApiKey(accessToken)
  if (!apiKey) {
    throw new Error(
      'AI_GATEWAY_API_KEY is not configured. Set it in Convex or the server environment.'
    )
  }

  if (!cachedGateway || cachedApiKey !== apiKey) {
    cachedGateway = createGateway({ apiKey })
    cachedApiKey = apiKey
  }

  return cachedGateway(getGatewayModelId(modelId))
}

async function getOrCreateGateway(accessToken?: string): Promise<ReturnType<typeof createGateway>> {
  const apiKey = await resolveGatewayApiKey(accessToken)
  if (!apiKey) {
    throw new Error(
      'AI_GATEWAY_API_KEY is not configured. Set it in Convex or the server environment.'
    )
  }
  if (!cachedGateway || cachedApiKey !== apiKey) {
    cachedGateway = createGateway({ apiKey })
    cachedApiKey = apiKey
  }
  return cachedGateway
}

export async function getGatewayImageModel(modelId: string, accessToken?: string) {
  const gateway = await getOrCreateGateway(accessToken)
  return gateway.image(modelId)
}

export async function getGatewayVideoModel(modelId: string, accessToken?: string) {
  const gateway = await getOrCreateGateway(accessToken)
  return gateway.video(modelId)
}

/** Cheap Gateway model to force a real provider `perplexity_search` round-trip (OpenRouter cannot send provider tools). */
const PERPLEXITY_PROXY_LANGUAGE_MODEL_ID = 'openai/gpt-oss-20b'

function isPerplexityErrorOutput(
  out: unknown,
): out is { error: string; message?: string } {
  return (
    typeof out === 'object' &&
    out != null &&
    'error' in out &&
    typeof (out as { error: unknown }).error === 'string'
  )
}

/**
 * Perplexity as a normal function `tool()` whose `execute` runs the real Gateway provider tool via a tiny
 * `generateText` pass on `openai/gpt-oss-20b`.
 *
 * We always use this wrapper (not `gateway.tools.perplexitySearch()` directly on the chat model) because:
 * 1. OpenRouter's adapter only sends `type: "function"` tools — provider tools are dropped.
 * 2. For AI Gateway chat models, native provider Perplexity returns inline `tool-result` with
 *    `providerExecuted: true`. The AI SDK multi-step loop then exits immediately (no client tool calls and
 *    no pending deferred results), so the model never runs a second step to turn search hits into an answer.
 */
function createPerplexitySearchFunctionTool(accessToken?: string) {
  return tool({
    description:
      'Search the public web for current information, news, and real-time facts (Perplexity via Vercel AI Gateway). ' +
      'Use for anything that needs the live web.',
    inputSchema: z.object({
      query: z
        .union([z.string().min(1), z.array(z.string().min(1)).max(5)])
        .describe('Search query string, or up to 5 queries to combine results'),
    }),
    execute: async (input) => {
      const apiKey = await resolveGatewayApiKey(accessToken)
      if (!apiKey) {
        throw new Error('AI Gateway API key is not configured (needed for web search)')
      }
      const gw = createGateway({ apiKey })
      const perplexityTool = gw.tools.perplexitySearch({
        maxResults: 8,
        maxTokens: 50_000,
        maxTokensPerPage: 2048,
        searchRecencyFilter: 'day',
      })
      const payload = { query: input.query }
      const prompt = `Call perplexity_search exactly once with this JSON input and no other tools:\n${JSON.stringify(payload)}`

      console.log('[AI Gateway] perplexity_search inner generateText start')
      const result = await generateText({
        model: gw(PERPLEXITY_PROXY_LANGUAGE_MODEL_ID),
        tools: { perplexity_search: perplexityTool },
        toolChoice: { type: 'tool', toolName: 'perplexity_search' },
        prompt,
        stopWhen: stepCountIs(2),
      })

      for (const step of result.steps) {
        for (const tr of step.toolResults) {
          if (tr.toolName !== 'perplexity_search' || tr.type !== 'tool-result') continue
          const out = tr.output
          if (isPerplexityErrorOutput(out)) {
            throw new Error(out.message || out.error || 'Perplexity search returned an error')
          }
          console.log('[AI Gateway] perplexity_search inner generateText OK')
          return out
        }
        for (const part of step.content) {
          if (part.type === 'tool-error' && part.toolName === 'perplexity_search') {
            throw new Error(
              part.error instanceof Error ? part.error.message : String(part.error),
            )
          }
        }
      }

      console.error('[AI Gateway] perplexity_search inner generateText missing tool result', {
        finishReason: result.finishReason,
        steps: result.steps.length,
      })
      throw new Error('Web search did not return results — check AI Gateway / Perplexity billing and logs')
    },
  })
}

/**
 * AI Gateway Perplexity web search tool (billed per Gateway pricing).
 * Returns null if no AI Gateway API key is configured.
 *
 * Always returns a **function** `tool()` wrapper so `streamText` performs client-side `execute`, which keeps
 * the tool loop alive for a follow-up model turn (see `createPerplexitySearchFunctionTool`).
 *
 * @param chatModelId — Logged for debugging only.
 */
export async function getGatewayPerplexitySearchTool(accessToken?: string, chatModelId?: string) {
  try {
    await getOrCreateGateway(accessToken)
    console.log('[AI Gateway] perplexity_search: function-tool wrapper for chat model', chatModelId ?? '(unknown)')
    return createPerplexitySearchFunctionTool(accessToken)
  } catch (err) {
    console.error('[AI Gateway] perplexity_search unavailable — check AI_GATEWAY_API_KEY:', err)
    return null
  }
}
