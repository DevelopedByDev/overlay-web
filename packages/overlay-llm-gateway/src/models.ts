import type { ModelInfo } from './contracts'

export type ModelCostTier = 0 | 1 | 2 | 3
export type ModelSpeedTier = 1 | 2 | 3

export interface OverlayModelInfo extends ModelInfo {
  intelligence: number
  cost: ModelCostTier
  speedTier: ModelSpeedTier
  supportsVision: boolean
  supportsReasoning: boolean
  supportsSearch: boolean
  supportsZeroDataRetention: boolean
  medianOutputTokensPerSecond?: number
}

export const FREE_TIER_AUTO_MODEL_ID = 'openrouter/free'
export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6'

export const BUILT_IN_MODELS: OverlayModelInfo[] = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Most capable', intelligence: 57.2, cost: 3, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: true, pricePer1mTokens: 4.5, medianOutputTokensPerSecond: 119.867 },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', description: 'Fast & efficient', intelligence: 20.6, cost: 1, speedTier: 3, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: true, pricePer1mTokens: 0.85, medianOutputTokensPerSecond: 186.767 },
  { id: 'google/gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B', provider: 'google', description: 'Efficient open model', intelligence: 18.8, cost: 1, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: true, pricePer1mTokens: 0.537, medianOutputTokensPerSecond: 50.262 },
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'openai', description: 'Powerful', intelligence: 56.8, cost: 3, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 5.625, medianOutputTokensPerSecond: 75.645 },
  { id: 'openai/gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'openai', description: 'Compact', intelligence: 13.8, cost: 1, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0.138, medianOutputTokensPerSecond: 120.344 },
  { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1', provider: 'openai', description: 'Reliable', intelligence: 17.3, cost: 2, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 4.375, medianOutputTokensPerSecond: 121.61 },
  { id: 'anthropic/claude-opus-4.7', name: 'Claude Opus 4.7', provider: 'anthropic', description: 'Most capable', intelligence: 57.3, cost: 3, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: true, pricePer1mTokens: 10.938, medianOutputTokensPerSecond: 55.247 },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', description: 'Best balance', intelligence: 44.4, cost: 3, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: true, pricePer1mTokens: 6.563, medianOutputTokensPerSecond: 53.877 },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', description: 'Fast & light', intelligence: 31.1, cost: 2, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: true, pricePer1mTokens: 2.188, medianOutputTokensPerSecond: 102.293 },
  { id: 'xai/grok-4.20-reasoning', name: 'Grok 4.20', provider: 'xai', description: 'Flagship reasoning', intelligence: 49.3, cost: 3, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 3.0, medianOutputTokensPerSecond: 98.293 },
  { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek', description: 'Flagship reasoning', intelligence: 51.5, cost: 2, speedTier: 1, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 2.175, medianOutputTokensPerSecond: 34.389 },
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek', description: 'Fast reasoning', intelligence: 46.5, cost: 1, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0.175, medianOutputTokensPerSecond: 72.385 },
  { id: 'minimax/minimax-m2.7', name: 'MiniMax M2.7', provider: 'minimax', description: 'Strong agentic coding', intelligence: 49.6, cost: 1, speedTier: 1, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0.525, medianOutputTokensPerSecond: 46.283 },
  { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', provider: 'moonshotai', description: 'Multimodal long-context', intelligence: 46.8, cost: 2, speedTier: 1, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 1.136, medianOutputTokensPerSecond: 48.829 },
  { id: 'z-ai/glm-5.1', name: 'GLM 5.1', provider: 'zai', description: 'Long-horizon coding', intelligence: 42.1, cost: 2, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 1.0, medianOutputTokensPerSecond: 90.037 },
  { id: 'qwen/qwen3.6-plus', name: 'Qwen 3.6 Plus', provider: 'alibaba', description: 'Agentic coding', intelligence: 50.0, cost: 2, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 1.125, medianOutputTokensPerSecond: 52.674 },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', provider: 'groq', description: 'Open weights', intelligence: 33.3, cost: 1, speedTier: 3, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: true, pricePer1mTokens: 0.262, medianOutputTokensPerSecond: 244.453 },
  { id: 'nvidia/nemotron-nano-9b-v2', name: 'Nemotron Nano 9B', provider: 'nvidia', description: 'Ultra-cheap summarization & tool-calling', intelligence: 13.2, cost: 1, speedTier: 2, supportsVision: false, supportsReasoning: false, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0.086, medianOutputTokensPerSecond: 132.545 },
  { id: FREE_TIER_AUTO_MODEL_ID, name: 'Free Router', provider: 'openrouter', description: 'Auto-selects a free model', intelligence: 25.0, cost: 0, speedTier: 2, supportsVision: true, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 100.0 },
  { id: 'openrouter/inclusionai/ring-2.6-1t:free', name: 'Free: Ring 2.6 1T', provider: 'openrouter', description: 'Free OpenRouter model', intelligence: 23.0, cost: 0, speedTier: 1, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 0 },
  { id: 'openrouter/deepseek/deepseek-v4-flash:free', name: 'Free: DeepSeek V4 Flash', provider: 'openrouter', description: 'Free OpenRouter model', intelligence: 46.5, cost: 0, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 0 },
  { id: 'openrouter/minimax/minimax-m2.5:free', name: 'Free: MiniMax M2.5', provider: 'openrouter', description: 'Free OpenRouter model', intelligence: 42.0, cost: 0, speedTier: 1, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 0 },
  { id: 'openrouter/arcee-ai/trinity-large-thinking:free', name: 'Free: Trinity Large Thinking', provider: 'openrouter', description: 'Free OpenRouter model', intelligence: 34.0, cost: 0, speedTier: 1, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 0 },
  { id: 'openrouter/openai/gpt-oss-120b:free', name: 'Free: GPT OSS 120B', provider: 'openrouter', description: 'Free OpenRouter model', intelligence: 33.3, cost: 0, speedTier: 3, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 0 },
  { id: 'openrouter/z-ai/glm-4.5-air:free', name: 'Free: GLM 4.5 Air', provider: 'openrouter', description: 'Free OpenRouter model', intelligence: 35.0, cost: 0, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 0 },
  { id: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', name: 'Free: Nemotron 3 Super 120B', provider: 'openrouter', description: 'Free OpenRouter model', intelligence: 34.5, cost: 0, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 0 },
  { id: 'stepfun-ai/step-3.5-flash', name: 'Free: Step 3.5 Flash', provider: 'nvidia', description: 'Free model', intelligence: 45.0, cost: 0, speedTier: 2, supportsVision: false, supportsReasoning: true, supportsSearch: false, supportsZeroDataRetention: false, pricePer1mTokens: 0, medianOutputTokensPerSecond: 0 },
]

export const MODEL_ID_ALIASES: Record<string, string> = {
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
  'deepseek-ai/deepseek-v3.2': 'stepfun-ai/step-3.5-flash',
  'moonshotai/kimi-k2-thinking': 'stepfun-ai/step-3.5-flash',
  'minimaxai/minimax-m2.7': 'stepfun-ai/step-3.5-flash',
}

export function resolveModelId(modelId: string): string {
  return MODEL_ID_ALIASES[modelId] ?? modelId
}

export function getModelForId(
  modelId: string,
  models: readonly OverlayModelInfo[] = BUILT_IN_MODELS,
): OverlayModelInfo | undefined {
  const resolved = resolveModelId(modelId)
  return models.find((model) => model.id === resolved)
}

export function listModelInfo(
  models: readonly OverlayModelInfo[] = BUILT_IN_MODELS,
): ModelInfo[] {
  return models.map((model) => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    description: model.description,
    supportsVision: model.supportsVision,
    supportsReasoning: model.supportsReasoning,
    supportsSearch: model.supportsSearch,
    supportsZeroDataRetention: model.supportsZeroDataRetention,
    pricePer1mTokens: model.pricePer1mTokens,
  }))
}
