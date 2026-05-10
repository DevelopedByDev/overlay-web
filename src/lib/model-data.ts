import type { ChatModel, ImageModel, VideoModel, VideoSubMode } from './model-types'
import {
  FREE_TIER_AUTO_MODEL_ID,
  DEFAULT_MODEL_ID,
  isNvidiaNimChatModelId,
} from './model-types'

export const AVAILABLE_MODELS: ChatModel[] = [
  // Google Models
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Most capable', intelligence: 57.2, cost: 3, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 4.5, medianOutputTokensPerSecond: 119.867 },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', description: 'Fast & efficient', intelligence: 20.6, cost: 1, speedTier: 3, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 0.85, medianOutputTokensPerSecond: 186.767 },
  { id: 'google/gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B', provider: 'google', description: 'Efficient open model', intelligence: 18.8, cost: 1, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 0.537, medianOutputTokensPerSecond: 50.262 },

  // OpenAI Models
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'openai', description: 'Powerful', intelligence: 56.8, cost: 3, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 5.625, medianOutputTokensPerSecond: 75.645 },
  { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'openai', description: 'Compact', intelligence: 13.8, cost: 1, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 0.138, medianOutputTokensPerSecond: 120.344 },
  { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1', provider: 'openai', description: 'Reliable', intelligence: 17.3, cost: 2, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 4.375, medianOutputTokensPerSecond: 121.61 },

  // Anthropic Models
  { id: 'anthropic/claude-opus-4.7', name: 'Claude Opus 4.7', provider: 'anthropic', description: 'Most capable', intelligence: 57.3, cost: 3, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 10.938, medianOutputTokensPerSecond: 55.247 },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', description: 'Best balance', intelligence: 44.4, cost: 3, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 6.563, medianOutputTokensPerSecond: 53.877 },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', description: 'Fast & light', intelligence: 31.1, cost: 2, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 2.188, medianOutputTokensPerSecond: 102.293 },

  // xAI Models
  { id: 'xai/grok-4.20-reasoning', name: 'Grok 4.20', provider: 'xai', description: 'Flagship reasoning', intelligence: 49.3, cost: 3, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 3.0, medianOutputTokensPerSecond: 98.293 },

  // Other frontier / open models
  { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek', description: 'Flagship reasoning', intelligence: 51.5, cost: 2, speedTier: 1, supportsVision: false, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 2.175, medianOutputTokensPerSecond: 34.389 },
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek', description: 'Fast reasoning', intelligence: 46.5, cost: 1, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 0.175, medianOutputTokensPerSecond: 72.385 },
  { id: 'minimax/minimax-m2.7', name: 'MiniMax M2.7', provider: 'minimax', description: 'Strong agentic coding', intelligence: 49.6, cost: 1, speedTier: 1, supportsVision: false, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 0.525, medianOutputTokensPerSecond: 46.283 },
  { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', provider: 'moonshotai', description: 'Multimodal long-context', intelligence: 46.8, cost: 2, speedTier: 1, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 1.136, medianOutputTokensPerSecond: 48.829 },
  { id: 'z-ai/glm-5.1', name: 'GLM 5.1', provider: 'zai', description: 'Long-horizon coding', intelligence: 42.1, cost: 2, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 1.0, medianOutputTokensPerSecond: 90.037 },
  { id: 'qwen/qwen3.6-plus', name: 'Qwen 3.6 Plus', provider: 'alibaba', description: 'Agentic coding', intelligence: 50.0, cost: 2, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 1.125, medianOutputTokensPerSecond: 52.674 },

  // Groq Models
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', provider: 'groq', description: 'Open weights', intelligence: 33.3, cost: 1, speedTier: 3, supportsVision: false, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 0.262, medianOutputTokensPerSecond: 244.453 },

  // NVIDIA Gateway — internal-only title / summarization model (not shown in dropdown)
  { id: 'nvidia/nemotron-nano-9b-v2', name: 'Nemotron Nano 9B', provider: 'nvidia', description: 'Ultra-cheap summarization & tool-calling', intelligence: 13.2, cost: 1, speedTier: 2, supportsVision: false, supportsReasoning: false, supportsSearch: false, pricePer1mTokens: 0.086, medianOutputTokensPerSecond: 132.545 },

  // OpenRouter (free) — only the auto router; API id stays `openrouter/free` (do not send bare `free`).
  { id: FREE_TIER_AUTO_MODEL_ID, name: 'Free Router', provider: 'openrouter', description: 'Auto-selects a free model', intelligence: 25.0, cost: 0, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 100.0 },

  // NVIDIA NIM — explicit free catalog rows use NIM directly.
  { id: 'deepseek-ai/deepseek-v3.2', name: 'Free: DeepSeek V3.2', provider: 'nvidia', description: 'Free model', intelligence: 27.1, cost: 0, speedTier: 1, supportsVision: false, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 0 },
  { id: 'moonshotai/kimi-k2-thinking', name: 'Free: Kimi K2 Thinking', provider: 'nvidia', description: 'Free model', intelligence: 40.9, cost: 0, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 117.231 },
]

/**
 * Highest quality first — used when picking a default Act model from a multi-model
 * selection and when synthesizing a shared prior thread for newly added chat models.
 */
export const CHAT_MODEL_QUALITY_PRIORITY: string[] = [
  'anthropic/claude-opus-4.7',
  'gemini-3.1-pro-preview',
  'gpt-5.4',
  'claude-sonnet-4-6',
  'xai/grok-4.20-reasoning',
  'deepseek/deepseek-v4-pro',
  'deepseek/deepseek-v4-flash',
  'moonshotai/kimi-k2.6',
  'qwen/qwen3.6-plus',
  'gemini-3-flash-preview',
  'openai/gpt-5.4-mini',
  'z-ai/glm-5.1',
  'gpt-4.1-2025-04-14',
  'claude-haiku-4-5',
  'google/gemma-4-26b-a4b-it',
  'openai/gpt-oss-120b',
  'nvidia/nemotron-nano-9b-v2',
  'minimax/minimax-m2.7',
  'moonshotai/kimi-k2-thinking',
  'deepseek-ai/deepseek-v3.2',
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
  'claude-opus-4-6': 'anthropic/claude-opus-4.7',
  'moonshotai/kimi-k2.5': 'moonshotai/kimi-k2.6',
  'moonshotai/kimi-k2-instruct-0905': 'moonshotai/kimi-k2.6',
  'moonshotai/kimi-k2-0905': 'moonshotai/kimi-k2.6',
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

/** True for free-tier rows (Auto router + free NVIDIA NIM catalog ids). */
function isFreeTierModelId(id: string): boolean {
  return id === FREE_TIER_AUTO_MODEL_ID || isNvidiaNimChatModelId(id)
}

/**
 * Models sorted by intelligence (CHAT_MODEL_QUALITY_PRIORITY order).
 * For free-tier users, free models are hoisted above premium models so the
 * options they can actually use without upgrading appear first.
 */
export function getModelsByIntelligence(isFreeTier: boolean): ChatModel[] {
  const idxMap = new Map(CHAT_MODEL_QUALITY_PRIORITY.map((id, i) => [id, i]))
  const sorted = [...AVAILABLE_MODELS].sort(
    (a, b) => (idxMap.get(a.id) ?? 999) - (idxMap.get(b.id) ?? 999),
  )
  if (!isFreeTier) return sorted
  const free = sorted.filter((m) => isFreeTierModelId(m.id))
  const premium = sorted.filter((m) => !isFreeTierModelId(m.id))
  return [...free, ...premium]
}

// ─── Image Models (priority order — top = highest priority fallback) ──────────

export const IMAGE_MODELS: ImageModel[] = [
  { id: 'openai/gpt-image-1.5', name: 'GPT Image 1.5', provider: 'openai', description: 'High quality, detailed', defaultAspectRatio: '1:1' },
  { id: 'xai/grok-imagine-image-pro', name: 'Grok Image Pro', provider: 'xai', description: 'Photorealistic', defaultAspectRatio: '1:1' },
  { id: 'xai/grok-imagine-image', name: 'Grok Image', provider: 'xai', description: 'Fast & creative', defaultAspectRatio: '1:1' },
  { id: 'bfl/flux-2-max', name: 'FLUX 2 Max', provider: 'bfl', description: 'Premium quality', defaultAspectRatio: '1:1' },
  { id: 'prodia/flux-fast-schnell', name: 'FLUX Schnell', provider: 'prodia', description: 'Ultra-fast, low cost', defaultAspectRatio: '1:1' },
  { id: 'bytedance/seedream-5.0-lite', name: 'Seedream 5.0 Lite', provider: 'bytedance', description: 'Fast generation', defaultAspectRatio: '1:1' },
  { id: 'bytedance/seedream-4.5', name: 'Seedream 4.5', provider: 'bytedance', description: 'Balanced quality', defaultAspectRatio: '1:1' },
]

export function getImageModel(id: string): ImageModel | undefined {
  return IMAGE_MODELS.find((m) => m.id === id)
}

// ─── Video Models (priority order — top = highest priority fallback) ──────────

export const VIDEO_MODELS: VideoModel[] = [
  // Text-to-video + Image-to-video
  { id: 'google/veo-3.1-generate-001', name: 'Veo 3.1', provider: 'google', description: 'Highest quality', billingUnit: 'per_video', defaultDuration: 8, defaultAspectRatio: '16:9', subModes: ['text-to-video', 'image-to-video'] },
  { id: 'google/veo-3.1-fast-generate-001', name: 'Veo 3.1 Fast', provider: 'google', description: 'Fast generation', billingUnit: 'per_video', defaultDuration: 8, defaultAspectRatio: '16:9', subModes: ['text-to-video', 'image-to-video'] },
  { id: 'bytedance/seedance-v1.5-pro', name: 'Seedance v1.5 Pro', provider: 'bytedance', description: 'Cinematic quality', billingUnit: 'per_second', defaultDuration: 10, defaultAspectRatio: '16:9', subModes: ['text-to-video', 'image-to-video'] },
  { id: 'xai/grok-imagine-video', name: 'Grok Video', provider: 'xai', description: 'Creative & fast', billingUnit: 'per_video', defaultDuration: 8, defaultAspectRatio: '16:9', subModes: ['text-to-video', 'image-to-video', 'video-editing'] },
  // Text-to-video only
  { id: 'alibaba/wan-v2.6-t2v', name: 'Wan v2.6', provider: 'alibaba', description: 'Versatile', billingUnit: 'per_second', defaultDuration: 8, defaultAspectRatio: '16:9', subModes: ['text-to-video'] },
  { id: 'klingai/kling-v2.6-t2v', name: 'Kling v2.6', provider: 'klingai', description: 'Cinematic motion', billingUnit: 'per_video', defaultDuration: 5, defaultAspectRatio: '16:9', subModes: ['text-to-video'] },
  // Image-to-video only
  { id: 'klingai/kling-v2.6-i2v', name: 'Kling v2.6 I2V', provider: 'klingai', description: 'Animate images', billingUnit: 'per_video', defaultDuration: 5, defaultAspectRatio: '16:9', subModes: ['image-to-video'] },
  { id: 'alibaba/wan-v2.6-i2v', name: 'Wan v2.6 I2V', provider: 'alibaba', description: 'Image animation', billingUnit: 'per_second', defaultDuration: 5, defaultAspectRatio: '16:9', subModes: ['image-to-video'] },
  // Reference-to-video
  { id: 'alibaba/wan-v2.6-r2v', name: 'Wan v2.6 R2V', provider: 'alibaba', description: 'Character references', billingUnit: 'per_second', defaultDuration: 5, defaultAspectRatio: '16:9', subModes: ['reference-to-video'] },
  // Motion control
  { id: 'klingai/kling-v2.6-motion-control', name: 'Kling Motion Control', provider: 'klingai', description: 'Transfer motion', billingUnit: 'per_video', defaultDuration: 5, defaultAspectRatio: '16:9', subModes: ['motion-control'] },
]

export function getVideoModel(id: string): VideoModel | undefined {
  return VIDEO_MODELS.find((m) => m.id === id)
}

export function getVideoModelsBySubMode(subMode: VideoSubMode): VideoModel[] {
  return VIDEO_MODELS.filter((m) => m.subModes.includes(subMode))
}
