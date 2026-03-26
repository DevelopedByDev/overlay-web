/**
 * Model Pricing Configuration
 * Per-model token pricing used for credit deduction in subscription billing
 */

export interface ModelPricing {
  inputPer1M: number // $/M input tokens
  cachedInputPer1M: number // $/M cached input tokens
  outputPer1M: number // $/M output tokens
  isFree: boolean
}

// ─── Generation Pricing (image / video) ──────────────────────────────────────
// Prices sourced from Vercel AI Gateway (provider list price, no markup).
// Image: $/image at default quality/size.
// Video: billingUnit='per_video' → $/clip | billingUnit='per_second' → $/second.

export interface ImageGenerationPricing {
  perImage: number // cost in dollars per generated image
}

export interface VideoGenerationPricing {
  billingUnit: 'per_video' | 'per_second'
  rate: number // dollars per video OR dollars per second
}

export interface BrowserUseV3Pricing {
  inputPer1M: number
  outputPer1M: number
}

export const BROWSER_USE_TASK_INIT_USD = 0.01

export const BROWSER_USE_V3_MODEL_PRICING: Record<'bu-mini' | 'bu-max', BrowserUseV3Pricing> = {
  'bu-mini': { inputPer1M: 0.72, outputPer1M: 4.2 },
  'bu-max': { inputPer1M: 3.6, outputPer1M: 18.0 },
}

export const IMAGE_GENERATION_PRICING: Record<string, ImageGenerationPricing> = {
  // Google Gemini Flash Image — token-based multimodal, ~$0.075/image at standard quality
  'google/gemini-3.1-flash-image-preview': { perImage: 0.075 },
  // OpenAI GPT Image 1.5 — $0.04/image (standard 1024x1024)
  'openai/gpt-image-1.5': { perImage: 0.04 },
  // BFL FLUX 2 Max — $0.12/image
  'bfl/flux-2-max': { perImage: 0.12 },
  // xAI Grok Imagine Image Pro — $0.07/image
  'xai/grok-imagine-image-pro': { perImage: 0.07 },
  // xAI Grok Imagine Image — $0.02/image
  'xai/grok-imagine-image': { perImage: 0.02 },
  // Prodia FLUX Schnell — ultra-fast, $0.003/image
  'prodia/flux-fast-schnell': { perImage: 0.003 },
}

export const VIDEO_GENERATION_PRICING: Record<string, VideoGenerationPricing> = {
  // Google Veo 3.1 — $0.1681/video (per-video billing)
  'google/veo-3.1-generate-001': { billingUnit: 'per_video', rate: 0.1681 },
  // Google Veo 3.1 Fast — ~$0.084/video (estimated ~50% of 3.1)
  'google/veo-3.1-fast-generate-001': { billingUnit: 'per_video', rate: 0.084 },
  // ByteDance Seedance v1.5 Pro — $0.0259/second (720p, no audio)
  'bytedance/seedance-v1.5-pro': { billingUnit: 'per_second', rate: 0.0259 },
  // xAI Grok Imagine Video — $0.07/second (720p)
  'xai/grok-imagine-video': { billingUnit: 'per_second', rate: 0.07 },
  // Alibaba Wan v2.6 — $0.10/second (720p)
  'alibaba/wan-v2.6-t2v': { billingUnit: 'per_second', rate: 0.10 },
}

/**
 * Calculate cost of an image generation in dollars.
 */
export function calculateImageCost(modelId: string): number {
  return IMAGE_GENERATION_PRICING[modelId]?.perImage ?? 0.05
}

/**
 * Calculate cost of a video generation in dollars.
 * @param durationSeconds - actual or estimated video duration in seconds
 */
export function calculateVideoCost(modelId: string, durationSeconds: number): number {
  const pricing = VIDEO_GENERATION_PRICING[modelId]
  if (!pricing) return 0.15
  if (pricing.billingUnit === 'per_video') return pricing.rate
  return pricing.rate * durationSeconds
}

export function calculateBrowserUseV3TokenCost(
  modelId: 'bu-mini' | 'bu-max',
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = BROWSER_USE_V3_MODEL_PRICING[modelId]
  return (Math.max(0, inputTokens) / 1_000_000) * pricing.inputPer1M + (Math.max(0, outputTokens) / 1_000_000) * pricing.outputPer1M
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Free models (OpenRouter)
  'openrouter/free': { inputPer1M: 0, cachedInputPer1M: 0, outputPer1M: 0, isFree: true },
  'openrouter/hunter-alpha': { inputPer1M: 0, cachedInputPer1M: 0, outputPer1M: 0, isFree: true },
  'openrouter/healer-alpha': { inputPer1M: 0, cachedInputPer1M: 0, outputPer1M: 0, isFree: true },
  'openrouter/arcee-ai/trinity-large-preview:free': { inputPer1M: 0, cachedInputPer1M: 0, outputPer1M: 0, isFree: true },
  'arcee-ai/trinity-large-preview:free': { inputPer1M: 0, cachedInputPer1M: 0, outputPer1M: 0, isFree: true },

  // Anthropic Claude
  'claude-opus-4-6': { inputPer1M: 5.0, cachedInputPer1M: 0.5, outputPer1M: 25.0, isFree: false },
  'claude-sonnet-4-6': { inputPer1M: 3.0, cachedInputPer1M: 0.3, outputPer1M: 15.0, isFree: false },
  'claude-haiku-4-5': { inputPer1M: 1.0, cachedInputPer1M: 0.1, outputPer1M: 5.0, isFree: false },

  // Google Gemini
  'gemini-3.1-pro-preview': { inputPer1M: 2.0, cachedInputPer1M: 0.2, outputPer1M: 12.0, isFree: false },
  'gemini-3-flash-preview': { inputPer1M: 0.5, cachedInputPer1M: 0.05, outputPer1M: 3.0, isFree: false },
  'gemini-2.5-flash': { inputPer1M: 0.3, cachedInputPer1M: 0.03, outputPer1M: 2.5, isFree: false },
  'gemini-2.5-flash-lite': { inputPer1M: 0.1, cachedInputPer1M: 0.01, outputPer1M: 0.4, isFree: false },

  // OpenAI
  'gpt-5.2-pro-2025-12-11': { inputPer1M: 2.5, cachedInputPer1M: 0.25, outputPer1M: 20.0, isFree: false },
  'gpt-5.2-2025-12-11': { inputPer1M: 1.75, cachedInputPer1M: 0.175, outputPer1M: 14.0, isFree: false },
  'gpt-5-mini-2025-08-07': { inputPer1M: 0.25, cachedInputPer1M: 0.025, outputPer1M: 2.0, isFree: false },
  'gpt-5-nano-2025-08-07': { inputPer1M: 0.05, cachedInputPer1M: 0.005, outputPer1M: 0.4, isFree: false },
  'gpt-4.1-2025-04-14': { inputPer1M: 2.0, cachedInputPer1M: 0.5, outputPer1M: 8.0, isFree: false },

  // xAI Grok
  'grok-4-1-fast-reasoning': { inputPer1M: 0.2, cachedInputPer1M: 0.2, outputPer1M: 0.5, isFree: false },

  // Groq
  'llama-3.3-70b-versatile': { inputPer1M: 0.59, cachedInputPer1M: 0.59, outputPer1M: 0.79, isFree: false },
  'moonshotai/kimi-k2-0905': { inputPer1M: 1.0, cachedInputPer1M: 0.5, outputPer1M: 3.0, isFree: false },
  'moonshotai/kimi-k2-instruct-0905': { inputPer1M: 1.0, cachedInputPer1M: 0.5, outputPer1M: 3.0, isFree: false },
  'openai/gpt-oss-20b': { inputPer1M: 0.075, cachedInputPer1M: 0.0375, outputPer1M: 0.3, isFree: false },
  'openai/gpt-oss-120b': { inputPer1M: 0.15, cachedInputPer1M: 0.075, outputPer1M: 0.6, isFree: false },
}

/**
 * Calculate token cost for a request.
 * @returns Cost in dollars
 */
export function calculateTokenCost(
  modelId: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[modelId]
  if (!pricing) return 0
  if (pricing.isFree) return 0

  const uncachedInput = Math.max(0, inputTokens - cachedInputTokens)
  const inputCost = (uncachedInput / 1_000_000) * pricing.inputPer1M
  const cachedCost = (cachedInputTokens / 1_000_000) * pricing.cachedInputPer1M
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M

  return inputCost + cachedCost + outputCost
}

export function isPremiumModel(modelId: string): boolean {
  const pricing = MODEL_PRICING[modelId]
  return pricing ? !pricing.isFree : true
}
