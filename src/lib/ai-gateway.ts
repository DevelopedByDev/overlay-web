import { createGateway, generateText, type ToolSet, stepCountIs, tool } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import { FREE_TIER_AUTO_MODEL_ID, getModel, isNvidiaNimChatModelId, modelUsesOpenRouterTransport } from '@/lib/models'
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

/**
 * Small but reliable Gateway model to force a real provider tool round-trip (OpenRouter cannot send provider tools).
 * gpt-4.1-mini follows forced tool-calling more reliably than ultra-small OSS models.
 */
const GATEWAY_TOOL_PROXY_MODEL_ID = 'openai/gpt-4.1-mini'

/**
 * Model for the inner `generateText` pass that must call Gateway provider tools (Perplexity / Parallel).
 * Prefer the same chat model as the user when it is available on the AI Gateway; otherwise a small
 * reliable OpenAI model (OpenRouter-only and free-router ids cannot run provider tools on Gateway).
 */
export function resolveGatewayProviderToolProxyModelId(chatModelId: string): string {
  if (!getModel(chatModelId)) {
    return GATEWAY_TOOL_PROXY_MODEL_ID
  }
  if (chatModelId === FREE_TIER_AUTO_MODEL_ID || modelUsesOpenRouterTransport(chatModelId) || isNvidiaNimChatModelId(chatModelId)) {
    return GATEWAY_TOOL_PROXY_MODEL_ID
  }
  return getGatewayModelId(chatModelId)
}

const PERPLEXITY_DEFAULTS = {
  maxResults: 10,
  maxTokens: 50_000,
  maxTokensPerPage: 2048,
  /** Bias toward research-quality results; use `day`/`week` only for breaking news. */
  searchRecencyFilter: 'year' as const,
}

const PARALLEL_DEFAULTS = {
  mode: 'one-shot' as const,
  maxResults: 10,
  excerpts: { maxCharsPerResult: 5000, maxCharsTotal: 80_000 },
}

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

function isParallelErrorOutput(
  out: unknown,
): out is { error: string; message?: string } {
  return (
    typeof out === 'object' &&
    out != null &&
    'error' in out &&
    typeof (out as { error: unknown }).error === 'string'
  )
}

export type GatewayPerplexitySearchParams = {
  query: string | string[]
  maxResults?: number
  maxTokensPerPage?: number
  maxTokens?: number
  country?: string
  searchDomainFilter?: string[]
  searchLanguageFilter?: string[]
  searchAfterDate?: string
  searchBeforeDate?: string
  lastUpdatedAfterFilter?: string
  lastUpdatedBeforeFilter?: string
  searchRecencyFilter?: 'day' | 'week' | 'month' | 'year'
}

/**
 * Perplexity as a normal function `tool()` whose `execute` runs the real Gateway provider tool via a tiny
 * `generateText` pass on a Gateway model.
 *
 * We always use this wrapper (not `gateway.tools.perplexitySearch()` directly on the chat model) because:
 * 1. OpenRouter's adapter only sends `type: "function"` tools — provider tools are dropped.
 * 2. For AI Gateway chat models, native provider Perplexity returns inline `tool-result` with
 *    `providerExecuted: true`. The AI SDK multi-step loop then exits immediately (no client tool calls and
 *    no pending deferred results), so the model never runs a second step to turn search hits into an answer.
 */
/**
 * Runs the same Perplexity round-trip as `perplexity_search` tool `execute` (Gateway inner generateText).
 * Used to recover when a weak model prints fake tool JSON instead of invoking tools.
 */
export async function runPerplexitySearchDirectForRepair(
  accessToken: string | undefined,
  query: string | string[],
  options?: Partial<Omit<GatewayPerplexitySearchParams, 'query'>>,
  innerProxyModelId: string = GATEWAY_TOOL_PROXY_MODEL_ID,
): Promise<unknown> {
  return executeGatewayPerplexitySearch(accessToken, { query, ...options }, innerProxyModelId)
}

/** Build Perplexity provider tool input (snake_case) for the inner tool call. */
function buildPerplexityProviderPayload(
  p: GatewayPerplexitySearchParams,
): Record<string, unknown> {
  const recency = p.searchRecencyFilter ?? PERPLEXITY_DEFAULTS.searchRecencyFilter
  const hasDateRange = Boolean(
    p.searchAfterDate ||
      p.searchBeforeDate ||
      p.lastUpdatedAfterFilter ||
      p.lastUpdatedBeforeFilter,
  )
  const out: Record<string, unknown> = {
    query: p.query,
    max_results: p.maxResults ?? PERPLEXITY_DEFAULTS.maxResults,
    max_tokens_per_page: p.maxTokensPerPage ?? PERPLEXITY_DEFAULTS.maxTokensPerPage,
    max_tokens: p.maxTokens ?? PERPLEXITY_DEFAULTS.maxTokens,
  }
  if (p.country) out.country = p.country
  if (p.searchDomainFilter?.length) out.search_domain_filter = p.searchDomainFilter
  if (p.searchLanguageFilter?.length) out.search_language_filter = p.searchLanguageFilter
  if (p.searchAfterDate) out.search_after_date = p.searchAfterDate
  if (p.searchBeforeDate) out.search_before_date = p.searchBeforeDate
  if (p.lastUpdatedAfterFilter) out.last_updated_after_filter = p.lastUpdatedAfterFilter
  if (p.lastUpdatedBeforeFilter) out.last_updated_before_filter = p.lastUpdatedBeforeFilter
  if (!hasDateRange) {
    out.search_recency_filter = recency
  }
  return out
}

async function runInnerGenerateTextWithTool<T extends 'perplexity_search' | 'parallel_search'>(params: {
  toolName: T
  tool: NonNullable<ToolSet[string]>
  prompt: string
  gw: ReturnType<typeof createGateway>
  /** AI Gateway id for the model that will emit the (forced) provider tool call, e.g. `anthropic/claude-3-5-sonnet-...` */
  innerProxyModelId: string
  maxAttempts: number
}): Promise<ReturnType<typeof generateText>> {
  const { toolName, tool, prompt, gw, innerProxyModelId, maxAttempts } = params
  let last: Awaited<ReturnType<typeof generateText>> | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[AI Gateway] ${toolName} inner generateText start (attempt ${attempt}/${maxAttempts})`, {
      innerProxyModelId,
    })
    const tools: ToolSet =
      toolName === 'perplexity_search'
        ? { perplexity_search: tool }
        : { parallel_search: tool }
    last = await generateText({
      model: gw(innerProxyModelId),
      tools,
      toolChoice: { type: 'tool', toolName },
      prompt,
      stopWhen: stepCountIs(2),
    })
    const hasResult = last.steps?.some((step) =>
      step.toolResults?.some(
        (tr) => tr.toolName === toolName && tr.type === 'tool-result',
      ),
    )
    if (hasResult) return last
    console.warn(`[AI Gateway] ${toolName} missing tool result, retrying`, {
      attempt,
      finishReason: last.finishReason,
      stepCount: last.steps?.length,
    })
  }
  return last!
}

function extractPerplexityOutputFromResult(
  result: Awaited<ReturnType<typeof generateText>>,
  toolName: 'perplexity_search',
): unknown {
  for (const step of result.steps) {
    for (const tr of step.toolResults) {
      if (tr.toolName !== toolName || tr.type !== 'tool-result') continue
      const out = tr.output
      if (isPerplexityErrorOutput(out)) {
        throw new Error(out.message || out.error || 'Perplexity search returned an error')
      }
      return out
    }
    for (const part of step.content) {
      if (part.type === 'tool-error' && part.toolName === toolName) {
        throw new Error(
          part.error instanceof Error ? part.error.message : String(part.error),
        )
      }
    }
  }
  return undefined
}

function extractParallelOutputFromResult(
  result: Awaited<ReturnType<typeof generateText>>,
  toolName: 'parallel_search',
): unknown {
  for (const step of result.steps) {
    for (const tr of step.toolResults) {
      if (tr.toolName !== toolName || tr.type !== 'tool-result') continue
      const out = tr.output
      if (isParallelErrorOutput(out)) {
        throw new Error(out.message || out.error || 'Parallel search returned an error')
      }
      return out
    }
    for (const part of step.content) {
      if (part.type === 'tool-error' && part.toolName === toolName) {
        throw new Error(
          part.error instanceof Error ? part.error.message : String(part.error),
        )
      }
    }
  }
  return undefined
}

const INNER_TOOL_ATTEMPTS = 3

export async function executeGatewayPerplexitySearch(
  accessToken: string | undefined,
  params: GatewayPerplexitySearchParams,
  innerProxyModelId: string = GATEWAY_TOOL_PROXY_MODEL_ID,
): Promise<unknown> {
  const apiKey = await resolveGatewayApiKey(accessToken)
  if (!apiKey) {
    throw new Error('AI Gateway API key is not configured (needed for web search)')
  }
  const gw = createGateway({ apiKey })
  const perplexityTool = gw.tools.perplexitySearch({
    maxResults: PERPLEXITY_DEFAULTS.maxResults,
    maxTokens: PERPLEXITY_DEFAULTS.maxTokens,
    maxTokensPerPage: PERPLEXITY_DEFAULTS.maxTokensPerPage,
  })
  const payload = buildPerplexityProviderPayload(params)
  const prompt = `Call perplexity_search exactly once with this JSON input and no other tools:\n${JSON.stringify(payload)}`

  const result = await runInnerGenerateTextWithTool({
    toolName: 'perplexity_search',
    tool: perplexityTool,
    prompt,
    gw,
    innerProxyModelId,
    maxAttempts: INNER_TOOL_ATTEMPTS,
  })
  const extracted = extractPerplexityOutputFromResult(result, 'perplexity_search')
  if (extracted !== undefined) {
    console.log('[AI Gateway] perplexity_search inner generateText OK')
    return extracted
  }

  console.error('[AI Gateway] perplexity_search inner generateText missing tool result', {
    finishReason: result.finishReason,
    steps: result.steps.length,
  })
  throw new Error('Web search did not return results — check AI Gateway / Perplexity billing and logs')
}

export type GatewayParallelSearchParams = {
  objective: string
  searchQueries?: string[]
  mode?: 'one-shot' | 'agentic'
  maxResults?: number
  includeDomains?: string[]
  excludeDomains?: string[]
  afterDate?: string
  maxCharsPerResult?: number
  maxCharsTotal?: number
  maxAgeSeconds?: number
}

function buildParallelProviderPayload(
  p: GatewayParallelSearchParams,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    objective: p.objective,
    mode: p.mode ?? PARALLEL_DEFAULTS.mode,
    max_results: p.maxResults ?? PARALLEL_DEFAULTS.maxResults,
  }
  if (p.searchQueries?.length) out.search_queries = p.searchQueries
  const sp: Record<string, unknown> = {}
  if (p.includeDomains?.length) sp.include_domains = p.includeDomains
  if (p.excludeDomains?.length) sp.exclude_domains = p.excludeDomains
  if (p.afterDate) sp.after_date = p.afterDate
  if (Object.keys(sp).length) out.source_policy = sp
  const ex: Record<string, unknown> = {}
  const mcr = p.maxCharsPerResult ?? PARALLEL_DEFAULTS.excerpts.maxCharsPerResult
  const mct = p.maxCharsTotal ?? PARALLEL_DEFAULTS.excerpts.maxCharsTotal
  if (mcr) ex.max_chars_per_result = mcr
  if (mct) ex.max_chars_total = mct
  if (Object.keys(ex).length) out.excerpts = ex
  if (p.maxAgeSeconds != null) {
    out.fetch_policy = { max_age_seconds: p.maxAgeSeconds }
  }
  return out
}

export async function executeGatewayParallelSearch(
  accessToken: string | undefined,
  params: GatewayParallelSearchParams,
  innerProxyModelId: string = GATEWAY_TOOL_PROXY_MODEL_ID,
): Promise<unknown> {
  const apiKey = await resolveGatewayApiKey(accessToken)
  if (!apiKey) {
    throw new Error('AI Gateway API key is not configured (needed for web search)')
  }
  const gw = createGateway({ apiKey })
  const parallelTool = gw.tools.parallelSearch({
    mode: PARALLEL_DEFAULTS.mode,
    maxResults: PARALLEL_DEFAULTS.maxResults,
    excerpts: PARALLEL_DEFAULTS.excerpts,
  })
  const payload = buildParallelProviderPayload(params)
  const prompt = `Call parallel_search exactly once with this JSON input and no other tools:\n${JSON.stringify(payload)}`

  const result = await runInnerGenerateTextWithTool({
    toolName: 'parallel_search',
    tool: parallelTool,
    prompt,
    gw,
    innerProxyModelId,
    maxAttempts: INNER_TOOL_ATTEMPTS,
  })
  const extracted = extractParallelOutputFromResult(result, 'parallel_search')
  if (extracted !== undefined) {
    console.log('[AI Gateway] parallel_search inner generateText OK')
    return extracted
  }

  console.error('[AI Gateway] parallel_search inner generateText missing tool result', {
    finishReason: result.finishReason,
    steps: result.steps.length,
  })
  throw new Error('Deep web search did not return results — check AI Gateway / Parallel billing and logs')
}

const searchRecencyEnum = z.enum(['day', 'week', 'month', 'year'])

export const perplexitySearchInputSchema = z.object({
  query: z
    .union([z.string().min(1), z.array(z.string().min(1)).max(5)])
    .describe('Search query or up to 5 queries to merge'),
  maxResults: z.number().int().min(1).max(20).optional(),
  maxTokensPerPage: z.number().int().min(256).max(2048).optional(),
  maxTokens: z.number().int().min(1000).max(1_000_000).optional(),
  country: z
    .string()
    .length(2)
    .optional()
    .describe("ISO 3166-1 alpha-2 (e.g. 'US')"),
  searchDomainFilter: z
    .array(z.string().min(1))
    .max(20)
    .optional()
    .describe("Allowlist e.g. arxiv.org, pubmed.ncbi.nlm.nih.gov — or '-reddit.com' to exclude (max 20)"),
  searchLanguageFilter: z.array(z.string().min(2).max(2)).max(10).optional(),
  searchAfterDate: z
    .string()
    .optional()
    .describe("MM/DD/YYYY; cannot be combined with searchRecencyFilter in the same call"),
  searchBeforeDate: z.string().optional(),
  lastUpdatedAfterFilter: z.string().optional(),
  lastUpdatedBeforeFilter: z.string().optional(),
  searchRecencyFilter: searchRecencyEnum
    .optional()
    .describe('Relative time window. Default year. Use day/week for news'),
})

export const parallelSearchInputSchema = z.object({
  objective: z
    .string()
    .min(1)
    .max(5000)
    .describe(
      'Natural-language research goal; for academic work say so and name domains (e.g. arxiv, PubMed).',
    ),
  searchQueries: z
    .array(z.string().min(1).max(200))
    .max(8)
    .optional()
    .describe('Optional keyword queries to supplement the objective'),
  mode: z.enum(['one-shot', 'agentic']).optional(),
  maxResults: z.number().int().min(1).max(20).optional(),
  includeDomains: z.array(z.string().min(1)).optional(),
  excludeDomains: z.array(z.string().min(1)).optional(),
  afterDate: z
    .string()
    .optional()
    .describe('ISO 8601 date; only include sources published after this date'),
  maxCharsPerResult: z.number().int().min(200).max(20_000).optional(),
  maxCharsTotal: z.number().int().min(2000).max(200_000).optional(),
  maxAgeSeconds: z.number().int().min(0).optional(),
})

function createPerplexitySearchFunctionTool(accessToken: string | undefined, innerProxyModelId: string) {
  return tool({
    description:
      'Search the public web (Perplexity via Vercel AI Gateway). Use for quick lookups, news, and general web search. ' +
      'Supports up to 5 batched queries, domain allow/deny (e.g. arxiv.org, pubmed), language and recency filters. ' +
      'For heavy academic / multi-source research with long excerpts, prefer parallel_search.',
    inputSchema: perplexitySearchInputSchema,
    execute: async (input) => {
      const p: GatewayPerplexitySearchParams = {
        query: input.query,
        maxResults: input.maxResults,
        maxTokensPerPage: input.maxTokensPerPage,
        maxTokens: input.maxTokens,
        country: input.country,
        searchDomainFilter: input.searchDomainFilter,
        searchLanguageFilter: input.searchLanguageFilter,
        searchAfterDate: input.searchAfterDate,
        searchBeforeDate: input.searchBeforeDate,
        lastUpdatedAfterFilter: input.lastUpdatedAfterFilter,
        lastUpdatedBeforeFilter: input.lastUpdatedBeforeFilter,
        searchRecencyFilter: input.searchRecencyFilter,
      }
      return executeGatewayPerplexitySearch(accessToken, p, innerProxyModelId)
    },
  })
}

function createParallelSearchFunctionTool(accessToken: string | undefined, innerProxyModelId: string) {
  return tool({
    description:
      'Deep web research (Parallel AI via Vercel AI Gateway): LLM-optimized excerpts, strong for synthesis, ' +
      'citations, and domain-scoped research (e.g. include arxiv.org, nature.com). Use when the user needs ' +
      'high-quality sources, long snippets, or academic-style review — after quick perplexity_search if needed.',
    inputSchema: parallelSearchInputSchema,
    execute: async (input) => {
      return executeGatewayParallelSearch(
        accessToken,
        {
          objective: input.objective,
          searchQueries: input.searchQueries,
          mode: input.mode,
          maxResults: input.maxResults,
          includeDomains: input.includeDomains,
          excludeDomains: input.excludeDomains,
          afterDate: input.afterDate,
          maxCharsPerResult: input.maxCharsPerResult,
          maxCharsTotal: input.maxCharsTotal,
          maxAgeSeconds: input.maxAgeSeconds,
        },
        innerProxyModelId,
      )
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
 * @param chatModelId — Used to pick the inner Gateway model for forced provider tool calls (aligns with user’s selected model when possible).
 */
export async function getGatewayPerplexitySearchTool(accessToken?: string, chatModelId?: string) {
  try {
    await getOrCreateGateway(accessToken)
    const innerProxyModelId = chatModelId
      ? resolveGatewayProviderToolProxyModelId(chatModelId)
      : GATEWAY_TOOL_PROXY_MODEL_ID
    console.log('[AI Gateway] perplexity_search: function-tool wrapper for chat model', chatModelId ?? '(unknown)', {
      innerProxyModelId,
    })
    return createPerplexitySearchFunctionTool(accessToken, innerProxyModelId)
  } catch (err) {
    console.error('[AI Gateway] perplexity_search unavailable — check AI_GATEWAY_API_KEY:', err)
    return null
  }
}

export async function getGatewayParallelSearchTool(accessToken?: string, chatModelId?: string) {
  try {
    await getOrCreateGateway(accessToken)
    const innerProxyModelId = chatModelId
      ? resolveGatewayProviderToolProxyModelId(chatModelId)
      : GATEWAY_TOOL_PROXY_MODEL_ID
    console.log('[AI Gateway] parallel_search: function-tool wrapper for chat model', chatModelId ?? '(unknown)', {
      innerProxyModelId,
    })
    return createParallelSearchFunctionTool(accessToken, innerProxyModelId)
  } catch (err) {
    console.error('[AI Gateway] parallel_search unavailable — check AI_GATEWAY_API_KEY:', err)
    return null
  }
}
