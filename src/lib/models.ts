export type GenerationMode = 'text' | 'image' | 'video'

export interface ChatModel {
  id: string
  name: string
  provider:
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'groq'
    | 'xai'
    | 'openrouter'
    | 'moonshotai'
    | 'zai'
    | 'alibaba'
  description?: string
  intelligence: number
  /** 0 = free, 1 = cheap, 2 = mid, 3 = expensive */
  cost: 0 | 1 | 2 | 3
  /** Relative latency: 1 = heavier/slower, 3 = faster/lighter (for model picker UI). */
  speedTier: 1 | 2 | 3
  supportsVision: boolean
  supportsReasoning: boolean
  supportsSearch: boolean
}

export interface ImageModel {
  id: string
  name: string
  provider: string
  description?: string
  defaultAspectRatio?: string
}

export interface VideoModel {
  id: string
  name: string
  provider: string
  description?: string
  billingUnit: 'per_video' | 'per_second'
  defaultDuration?: number
  defaultAspectRatio?: string
}

export const FREE_TIER_AUTO_MODEL_ID = 'openrouter/free'

export const AVAILABLE_MODELS: ChatModel[] = [
  // Google Models
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Most capable', intelligence: 2, cost: 3, speedTier: 1, supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', description: 'Fast & efficient', intelligence: 1.5, cost: 2, speedTier: 3, supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'google/gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B', provider: 'google', description: 'Efficient open model', intelligence: 1.1, cost: 1, speedTier: 3, supportsVision: true, supportsReasoning: true, supportsSearch: false },

  // OpenAI Models
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'openai', description: 'Powerful', intelligence: 2, cost: 3, speedTier: 1, supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'openai', description: 'Compact', intelligence: 1.45, cost: 2, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1', provider: 'openai', description: 'Reliable', intelligence: 1.5, cost: 2, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false },

  // Anthropic Models
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', description: 'Most capable', intelligence: 2, cost: 3, speedTier: 1, supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', description: 'Best balance', intelligence: 1.75, cost: 2, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', description: 'Fast & light', intelligence: 1.25, cost: 1, speedTier: 3, supportsVision: true, supportsReasoning: true, supportsSearch: false },

  // xAI Models
  { id: 'xai/grok-4.20-reasoning', name: 'Grok 4.20', provider: 'xai', description: 'Flagship reasoning', intelligence: 1.8, cost: 3, speedTier: 1, supportsVision: true, supportsReasoning: true, supportsSearch: false },

  // Other frontier / open models
  { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5', provider: 'moonshotai', description: 'Multimodal long-context', intelligence: 1.7, cost: 2, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'z-ai/glm-5.1', name: 'GLM 5.1', provider: 'zai', description: 'Long-horizon coding', intelligence: 1.55, cost: 2, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false },
  { id: 'qwen/qwen3.6-plus', name: 'Qwen 3.6 Plus', provider: 'alibaba', description: 'Agentic coding', intelligence: 1.6, cost: 0, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false },

  // Groq Models
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', provider: 'groq', description: 'Open weights', intelligence: 1.25, cost: 1, speedTier: 3, supportsVision: false, supportsReasoning: true, supportsSearch: false },

  // OpenRouter (free) — only the auto router; API id stays `openrouter/free` (do not send bare `free`).
  { id: FREE_TIER_AUTO_MODEL_ID, name: 'Free', provider: 'openrouter', description: 'Auto-selects a free model', intelligence: 1.25, cost: 0, speedTier: 3, supportsVision: true, supportsReasoning: true, supportsSearch: false },
]

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6'

/**
 * Highest quality first — used when picking a default Act model from a multi-model
 * selection and when synthesizing a shared prior thread for newly added chat models.
 */
export const CHAT_MODEL_QUALITY_PRIORITY: string[] = [
  'claude-opus-4-6',
  'gemini-3.1-pro-preview',
  'gpt-5.4',
  'claude-sonnet-4-6',
  'xai/grok-4.20-reasoning',
  'moonshotai/kimi-k2.5',
  'qwen/qwen3.6-plus',
  'gemini-3-flash-preview',
  'openai/gpt-5.4-mini',
  'z-ai/glm-5.1',
  'gpt-4.1-2025-04-14',
  'claude-haiku-4-5',
  'google/gemma-4-26b-a4b-it',
  'openai/gpt-oss-120b',
  FREE_TIER_AUTO_MODEL_ID,
]

export function pickBestModelForAct(selectedAskModelIds: string[]): string {
  if (selectedAskModelIds.length === 1) return selectedAskModelIds[0]
  const sel = new Set(selectedAskModelIds)
  for (const id of CHAT_MODEL_QUALITY_PRIORITY) {
    if (sel.has(id)) return id
  }
  const first = selectedAskModelIds.find((id) => AVAILABLE_MODELS.some((m) => m.id === id))
  return first ?? DEFAULT_MODEL_ID
}

/** Persisted UI / Convex rows may still reference retired ids. */
const LEGACY_CHAT_MODEL_ID_ALIASES: Record<string, string> = {
  'moonshotai/kimi-k2-instruct-0905': 'moonshotai/kimi-k2.5',
  'moonshotai/kimi-k2-0905': 'moonshotai/kimi-k2.5',
  'gpt-5.2-pro-2025-12-11': 'gpt-5.4',
  'gpt-5.2-2025-12-11': 'gpt-5.4',
  'gpt-5-mini-2025-08-07': 'openai/gpt-5.4-mini',
  'gpt-5-nano-2025-08-07': 'openai/gpt-5.4-mini',
  'grok-4-1-fast-reasoning': 'xai/grok-4.20-reasoning',
  'openai/gpt-oss-20b': 'openai/gpt-oss-120b',
  'gemini-2.5-flash': 'gemini-3-flash-preview',
  'gemini-2.5-flash-lite': 'google/gemma-4-26b-a4b-it',
  'zai/glm-5.1': 'z-ai/glm-5.1',
  'alibaba/qwen3.6-plus': 'qwen/qwen3.6-plus',
}

export function getModel(id: string): ChatModel | undefined {
  const resolved = LEGACY_CHAT_MODEL_ID_ALIASES[id] ?? id
  return AVAILABLE_MODELS.find((m) => m.id === resolved)
}

/** 1–5 segments for relative response latency (higher = faster). */
export function speedTierToBarFill5(tier: ChatModel['speedTier']): number {
  return tier === 1 ? 2 : tier === 2 ? 3 : 5
}

/** 1–5 segments for relative $ (higher = pricier). Free tier uses 1. */
export function costToBarFill5(cost: ChatModel['cost']): number {
  if (cost === 0) return 1
  if (cost === 1) return 2
  if (cost === 2) return 3
  return 5
}

let _intelRange: { min: number; max: number } | null = null
function intelligenceRange(): { min: number; max: number } {
  if (_intelRange) return _intelRange
  const vals = AVAILABLE_MODELS.map((m) => m.intelligence)
  _intelRange = { min: Math.min(...vals), max: Math.max(...vals) }
  return _intelRange
}

/** 1–5 segments for relative intelligence score. */
export function intelligenceToBarFill5(m: ChatModel): number {
  const { min, max } = intelligenceRange()
  if (max <= min) return 3
  const n = Math.round(((m.intelligence - min) / (max - min)) * 4) + 1
  return Math.min(5, Math.max(1, n))
}

/** True when completions are served via the OpenRouter HTTP API (incl. Qwen catalog ids). */
export function modelUsesOpenRouterTransport(modelId: string): boolean {
  const p = getModel(modelId)?.provider
  return p === 'openrouter' || p === 'alibaba' || p === 'zai'
}

/** UI labels — resolves legacy / gateway ids (e.g. Kimi instruct variant) to catalog names. */
export function getChatModelDisplayName(modelId: string): string {
  return getModel(modelId)?.name ?? modelId
}

export function getProviderModels(provider: ChatModel['provider']): ChatModel[] {
  return AVAILABLE_MODELS.filter((m) => m.provider === provider)
}

/** Models sorted by intelligence (CHAT_MODEL_QUALITY_PRIORITY order), with free router first when on free tier. */
export function getModelsByIntelligence(isFreeTier: boolean): ChatModel[] {
  const idxMap = new Map(CHAT_MODEL_QUALITY_PRIORITY.map((id, i) => [id, i]))
  const sorted = [...AVAILABLE_MODELS].sort(
    (a, b) => (idxMap.get(a.id) ?? 999) - (idxMap.get(b.id) ?? 999),
  )
  if (isFreeTier) {
    const freeIdx = sorted.findIndex((m) => m.id === FREE_TIER_AUTO_MODEL_ID)
    if (freeIdx > 0) {
      const [free] = sorted.splice(freeIdx, 1)
      sorted.unshift(free!)
    }
  }
  return sorted
}

// ─── Image Models (priority order — top = highest priority fallback) ──────────

export const IMAGE_MODELS: ImageModel[] = [
  { id: 'openai/gpt-image-1.5', name: 'GPT Image 1.5', provider: 'openai', description: 'High quality, detailed', defaultAspectRatio: '1:1' },
  { id: 'xai/grok-imagine-image-pro', name: 'Grok Image Pro', provider: 'xai', description: 'Photorealistic', defaultAspectRatio: '1:1' },
  { id: 'xai/grok-imagine-image', name: 'Grok Image', provider: 'xai', description: 'Fast & creative', defaultAspectRatio: '1:1' },
  { id: 'bfl/flux-2-max', name: 'FLUX 2 Max', provider: 'bfl', description: 'Premium quality', defaultAspectRatio: '1:1' },
  { id: 'prodia/flux-fast-schnell', name: 'FLUX Schnell', provider: 'prodia', description: 'Ultra-fast, low cost', defaultAspectRatio: '1:1' },
]

export const DEFAULT_IMAGE_MODEL_ID = 'openai/gpt-image-1.5'

export function getImageModel(id: string): ImageModel | undefined {
  return IMAGE_MODELS.find((m) => m.id === id)
}

// ─── Video Models (priority order — top = highest priority fallback) ──────────

export const VIDEO_MODELS: VideoModel[] = [
  { id: 'google/veo-3.1-generate-001', name: 'Veo 3.1', provider: 'google', description: 'Highest quality', billingUnit: 'per_video', defaultDuration: 8, defaultAspectRatio: '16:9' },
  { id: 'google/veo-3.1-fast-generate-001', name: 'Veo 3.1 Fast', provider: 'google', description: 'Fast generation', billingUnit: 'per_video', defaultDuration: 8, defaultAspectRatio: '16:9' },
  { id: 'bytedance/seedance-v1.5-pro', name: 'Seedance v1.5 Pro', provider: 'bytedance', description: 'Cinematic quality', billingUnit: 'per_second', defaultDuration: 10, defaultAspectRatio: '16:9' },
  { id: 'xai/grok-imagine-video', name: 'Grok Video', provider: 'xai', description: 'Creative & fast', billingUnit: 'per_video', defaultDuration: 8, defaultAspectRatio: '16:9' },
  { id: 'alibaba/wan-v2.6-t2v', name: 'Wan v2.6', provider: 'alibaba', description: 'Versatile', billingUnit: 'per_second', defaultDuration: 8, defaultAspectRatio: '16:9' },
]

export const DEFAULT_VIDEO_MODEL_ID = 'google/veo-3.1-generate-001'

export function getVideoModel(id: string): VideoModel | undefined {
  return VIDEO_MODELS.find((m) => m.id === id)
}
