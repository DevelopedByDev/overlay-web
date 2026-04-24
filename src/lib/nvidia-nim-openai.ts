/**
 * NVIDIA NIM — OpenAI Chat Completions–compatible API via {@link createOpenAI} from `@ai-sdk/openai`.
 * Same client pattern as Vercel AI Gateway: custom `baseURL` + `apiKey` (see
 * https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions ).
 * Base URL: https://integrate.api.nvidia.com/v1
 */
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV3 } from '@ai-sdk/provider'
import { getServerProviderKey } from '@/lib/server-provider-keys'
import { NVIDIA_NIM_MODEL_IDS } from '@/lib/models'

export const NVIDIA_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1' as const

/**
 * Tried in order for free tier before `openrouter/free`.
 * Align with NIM build names (see NVIDIA NIM / build docs).
 */
export const FREE_TIER_NVIDIA_PREFERRED_MODEL_ORDER = [
  'deepseek-ai/deepseek-v4-pro',
  'deepseek-ai/deepseek-v4-flash',
  'minimaxai/minimax-m2.7',
  'deepseek-ai/deepseek-v3.2',
  'moonshotai/kimi-k2-thinking',
] as const satisfies readonly (typeof NVIDIA_NIM_MODEL_IDS)[number][]

export async function resolveNvidiaApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    const fromVault = await getServerProviderKey('nvidia')
    if (fromVault) {
      return fromVault
    }
  }
  return process.env.NVIDIA_API_KEY?.trim() || null
}

function withDeepseekThinkingTemplate(init?: RequestInit): RequestInit {
  if (!init?.body || typeof init.body !== 'string') {
    return init ?? {}
  }
  try {
    const body = JSON.parse(init.body) as Record<string, unknown>
    const m = body.model
    if (
      typeof m === 'string' &&
      (m.includes('deepseek-v3.2') || m.includes('deepseek-v4-flash') || m.includes('deepseek-v4-pro'))
    ) {
      const existing = body.chat_template_kwargs as Record<string, unknown> | undefined
      body.chat_template_kwargs = {
        ...existing,
        thinking: true,
        ...(m.includes('deepseek-v4-flash') || m.includes('deepseek-v4-pro')
          ? { reasoning_effort: 'high' }
          : {}),
      }
    }
    return { ...init, body: JSON.stringify(body) }
  } catch {
    return init
  }
}

/**
 * A single NIM model using `/v1/chat/completions` through the OpenAI-compatible AI SDK provider.
 */
export function createNvidiaNimChatLanguageModel(
  modelId: string,
  apiKey: string,
): LanguageModelV3 {
  const useThinkingMerge =
    modelId === 'deepseek-ai/deepseek-v3.2' ||
    modelId === 'deepseek-ai/deepseek-v4-flash' ||
    modelId === 'deepseek-ai/deepseek-v4-pro'
  const nvidia = createOpenAI({
    name: 'nvidia-nim',
    baseURL: NVIDIA_NIM_BASE_URL,
    apiKey,
    fetch: useThinkingMerge
      ? (url, init) => globalThis.fetch(url, withDeepseekThinkingTemplate(init))
      : globalThis.fetch,
  })
  return nvidia.chat(modelId)
}

/** True when we should try the next free-tier candidate (NVIDIA → OpenRouter). */
export function isRetryableFreeTierPrimaryModelError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error)
  const lower = raw.toLowerCase()
  if (
    /\b(429|502|503|504|status code: 5|timeout|econnreset|econnrefused|rate limit|throttl|overloaded|unavailable|model.*not found|not_available)\b/i.test(
      raw,
    )
  ) {
    return true
  }
  if (lower.includes('fetch failed') || lower.includes('network error')) {
    return true
  }
  if (lower.includes('400') && (lower.includes('model') || lower.includes('invalid'))) {
    return true
  }
  if (lower.includes('401') || lower.includes('403')) {
    // Bad/expired NIM key — try next candidate or OpenRouter
    return true
  }
  return true
}
