export interface ChatModel {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'xai' | 'openrouter'
  description?: string
  supportsVision: boolean
  supportsReasoning: boolean
  supportsSearch: boolean
}

export const AVAILABLE_MODELS: ChatModel[] = [
  // Google Models
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'google', description: 'Most capable', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', description: 'Fast & efficient', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', description: 'Balanced', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'google', description: 'Lightweight', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  // OpenAI Models
  { id: 'gpt-5.2-pro-2025-12-11', name: 'GPT-5.2 Pro', provider: 'openai', description: 'Most capable', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gpt-5.2-2025-12-11', name: 'GPT-5.2', provider: 'openai', description: 'Powerful', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini', provider: 'openai', description: 'Compact', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano', provider: 'openai', description: 'Fastest', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1', provider: 'openai', description: 'Reliable', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  // Anthropic Models
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', description: 'Most capable', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', description: 'Best balance', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', description: 'Fast & light', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  // xAI Models
  { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast', provider: 'xai', description: 'Fast reasoning', supportsVision: true, supportsReasoning: true, supportsSearch: false },
  // Groq Models
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', description: 'Versatile', supportsVision: false, supportsReasoning: false, supportsSearch: false },
]

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6'

export function getModel(id: string): ChatModel | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === id)
}

export function getProviderModels(provider: ChatModel['provider']): ChatModel[] {
  return AVAILABLE_MODELS.filter((m) => m.provider === provider)
}
