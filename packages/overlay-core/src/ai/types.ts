// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: AI inference layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
}

export interface ChatInferenceRequest {
  modelId: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  tools?: Array<{
    id: string
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
}

export interface ChatInferenceResponse {
  content: string
  toolCalls?: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
  }>
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface ImageInferenceRequest {
  modelId: string
  prompt: string
  aspectRatio?: string
  negativePrompt?: string
}

export interface ImageInferenceResponse {
  url: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
}

export interface VideoInferenceRequest {
  modelId: string
  prompt: string
  duration?: number
  aspectRatio?: string
  referenceImageUrl?: string
}

export interface VideoInferenceResponse {
  url: string
  mimeType: string
  sizeBytes: number
  durationSeconds: number
  width: number
  height: number
}
