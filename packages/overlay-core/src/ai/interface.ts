// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: AI inference layer (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import type {
  ChatInferenceRequest,
  ChatInferenceResponse,
  ImageInferenceRequest,
  ImageInferenceResponse,
  VideoInferenceRequest,
  VideoInferenceResponse,
} from './types'

export interface IAI {
  readonly providerId?: string
  init?(): Promise<void>
  health?(): Promise<{ ok: boolean; message?: string; latencyMs?: number }>
  shutdown?(): Promise<void>
  capabilities?(): Promise<AICapabilities> | AICapabilities

  chat(request: ChatInferenceRequest): Promise<ChatInferenceResponse>
  chatStream(
    request: ChatInferenceRequest
  ): AsyncGenerator<ChatInferenceResponse, void, unknown>

  generateImage(request: ImageInferenceRequest): Promise<ImageInferenceResponse>
  generateVideo(request: VideoInferenceRequest): Promise<VideoInferenceResponse>

  listModels(): Promise<AIModel[]>
}

export interface AICapabilities {
  chat: boolean
  streaming: boolean
  vision: boolean
  toolCalling: boolean
  image: boolean
  video: boolean
}

export interface AIModel {
  id: string
  name: string
  provider: string
  type: 'chat' | 'image' | 'video'
  description?: string
  costTier: 0 | 1 | 2 | 3
  supportsVision: boolean
  supportsReasoning: boolean
  supportsToolCalling: boolean
}
