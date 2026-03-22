export type GenerationMode = 'text' | 'image' | 'video'

export interface ChatModel {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'xai' | 'openrouter'
  openClawRef: string
  description?: string
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

export const AVAILABLE_MODELS: ChatModel[] = [
  // Google Models
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', openClawRef: 'vercel-ai-gateway/google/gemini-3.1-pro-preview', description: 'Most capable', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', openClawRef: 'vercel-ai-gateway/google/gemini-3-flash', description: 'Fast & efficient', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', openClawRef: 'vercel-ai-gateway/google/gemini-2.5-flash', description: 'Balanced', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'google', openClawRef: 'vercel-ai-gateway/google/gemini-2.5-flash-lite', description: 'Lightweight', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  // OpenAI Models
  { id: 'gpt-5.2-pro-2025-12-11', name: 'GPT-5.2 Pro', provider: 'openai', openClawRef: 'vercel-ai-gateway/openai/gpt-5.2-pro', description: 'Most capable', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gpt-5.2-2025-12-11', name: 'GPT-5.2', provider: 'openai', openClawRef: 'vercel-ai-gateway/openai/gpt-5.2', description: 'Powerful', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini', provider: 'openai', openClawRef: 'vercel-ai-gateway/openai/gpt-5-mini', description: 'Compact', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano', provider: 'openai', openClawRef: 'vercel-ai-gateway/openai/gpt-5-nano', description: 'Fastest', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1', provider: 'openai', openClawRef: 'vercel-ai-gateway/openai/gpt-4.1', description: 'Reliable', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  // Anthropic Models
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', openClawRef: 'vercel-ai-gateway/anthropic/claude-opus-4.6', description: 'Most capable', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', openClawRef: 'vercel-ai-gateway/anthropic/claude-sonnet-4.6', description: 'Best balance', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', openClawRef: 'vercel-ai-gateway/anthropic/claude-haiku-4.5', description: 'Fast & light', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  // xAI Models
  { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast', provider: 'xai', openClawRef: 'vercel-ai-gateway/xai/grok-4.1-fast-reasoning', description: 'Fast reasoning', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  // Groq Models
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', openClawRef: 'vercel-ai-gateway/meta/llama-3.3-70b', description: 'Versatile', supportsVision: false, supportsReasoning: false, supportsSearch: false },
  { id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2', provider: 'groq', openClawRef: 'vercel-ai-gateway/moonshotai/kimi-k2-0905', description: 'MoonShot AI', supportsVision: false, supportsReasoning: false, supportsSearch: false },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', provider: 'groq', openClawRef: 'vercel-ai-gateway/openai/gpt-oss-120b', description: 'OpenAI OSS', supportsVision: false, supportsReasoning: false, supportsSearch: false },
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', provider: 'groq', openClawRef: 'vercel-ai-gateway/openai/gpt-oss-20b', description: 'OpenAI OSS', supportsVision: false, supportsReasoning: false, supportsSearch: false },

  // OpenRouter (free) — `openrouter/free` etc. stay full id for the API; vendor slugs like `openrouter/arcee-ai/...` strip to `arcee-ai/...`.
  { id: 'openrouter/free', name: 'Free Router', provider: 'openrouter', openClawRef: 'openrouter/free', description: 'Auto free model', supportsVision: false, supportsReasoning: false, supportsSearch: false },
  { id: 'openrouter/hunter-alpha', name: 'Hunter Alpha', provider: 'openrouter', openClawRef: 'openrouter/hunter-alpha', description: 'Free alpha model', supportsVision: false, supportsReasoning: false, supportsSearch: false },
  { id: 'openrouter/healer-alpha', name: 'Healer Alpha', provider: 'openrouter', openClawRef: 'openrouter/healer-alpha', description: 'Free alpha model', supportsVision: false, supportsReasoning: false, supportsSearch: false },
  { id: 'openrouter/arcee-ai/trinity-large-preview:free', name: 'Trinity Large (Free)', provider: 'openrouter', openClawRef: 'openrouter/arcee-ai/trinity-large-preview:free', description: 'Free via OpenRouter', supportsVision: false, supportsReasoning: false, supportsSearch: false },
]

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6'

export function getModel(id: string): ChatModel | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === id)
}

export function getProviderModels(provider: ChatModel['provider']): ChatModel[] {
  return AVAILABLE_MODELS.filter((m) => m.provider === provider)
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
