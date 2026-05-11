// @overlay/core — extracted from src/lib/model-data.ts
// Canonical model registry. Zero framework dependencies.

import type { ChatModel, ImageModel, VideoModel, VideoSubMode, GenerationMode } from './model-types'
import {
  FREE_TIER_AUTO_MODEL_ID,
  DEFAULT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
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
  return selectedAskModelIds[0] ?? DEFAULT_MODEL_ID
}

export function getModelsByIntelligence(isFreeTier: boolean): ChatModel[] {
  const models = [...AVAILABLE_MODELS]
  models.sort((a, b) => b.intelligence - a.intelligence)
  if (isFreeTier) {
    // Auto router first, then everything else by intelligence
    const autoIndex = models.findIndex((m) => m.id === FREE_TIER_AUTO_MODEL_ID)
    if (autoIndex > 0) {
      const auto = models.splice(autoIndex, 1)[0]!
      models.unshift(auto)
    }
  }
  return models
}

export const IMAGE_MODELS: ImageModel[] = [
  { id: 'openai/gpt-image-1.5', name: 'GPT Image 1.5', provider: 'openai', description: 'High-fidelity', defaultAspectRatio: '1:1' },
  { id: 'xai/grok-imagine-image-pro', name: 'Grok Imagine Pro', provider: 'xai', description: 'Advanced', defaultAspectRatio: '1:1' },
  { id: 'xai/grok-imagine-image', name: 'Grok Imagine', provider: 'xai', description: 'Standard', defaultAspectRatio: '1:1' },
  { id: 'bfl/flux-2-max', name: 'FLUX 2 Max', provider: 'bfl', description: 'Best quality', defaultAspectRatio: '1:1' },
  { id: 'google/gemini-3.1-flash-image-preview', name: 'Gemini Flash Image', provider: 'google', description: 'Fast & cheap', defaultAspectRatio: '1:1' },
]

const VIDEO_SUB_MODES_ALL: VideoSubMode[] = [
  'text-to-video',
  'image-to-video',
  'reference-to-video',
  'motion-control',
  'video-editing',
]

export const VIDEO_MODELS: VideoModel[] = [
  { id: 'google/veo-3.1-generate-001', name: 'Veo 3.1', provider: 'google', description: 'High quality', billingUnit: 'per_video', defaultDuration: 8, defaultAspectRatio: '16:9', subModes: VIDEO_SUB_MODES_ALL },
  { id: 'google/veo-3.1-generate-preview-001', name: 'Veo 3.1 Preview', provider: 'google', description: 'Preview', billingUnit: 'per_video', defaultDuration: 5, defaultAspectRatio: '16:9', subModes: VIDEO_SUB_MODES_ALL },
  { id: 'google/veo-3.1-fast-generate-preview-001', name: 'Veo 3.1 Fast', provider: 'google', description: 'Faster generation', billingUnit: 'per_video', defaultDuration: 5, defaultAspectRatio: '16:9', subModes: ['text-to-video', 'image-to-video'] },
  { id: 'kling/kling-video-v2-pro', name: 'Kling Video v2 Pro', provider: 'kling', description: 'Cinematic', billingUnit: 'per_video', defaultDuration: 10, defaultAspectRatio: '16:9', subModes: VIDEO_SUB_MODES_ALL },
]

export const FREE_TIER_CHAT_MODELS = AVAILABLE_MODELS.filter((m) => m.cost === 0)
export const PAID_TIER_CHAT_MODELS = AVAILABLE_MODELS.filter((m) => m.cost > 0)

export function getModelById(modelId: string): ChatModel | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId)
}

export function isVisionModel(modelId: string): boolean {
  return getModelById(modelId)?.supportsVision ?? false
}

export function isReasoningModel(modelId: string): boolean {
  return getModelById(modelId)?.supportsReasoning ?? false
}

export function isSearchModel(modelId: string): boolean {
  return getModelById(modelId)?.supportsSearch ?? false
}

export function getDefaultModelIdForMode(mode: GenerationMode): string {
  if (mode === 'image') return DEFAULT_IMAGE_MODEL_ID
  if (mode === 'video') return DEFAULT_VIDEO_MODEL_ID
  return DEFAULT_MODEL_ID
}
