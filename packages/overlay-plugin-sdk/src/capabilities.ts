// @enterprise-future — not wired to production
// STATUS: Not wired to production. Safe to modify.
// WIRE TARGET: Plugin loader (when Phase 7 is approved)
// RISK LEVEL: Low (no production imports)

import { z } from 'zod'
import type { PluginContext } from './context'

export interface ToolDefinition {
  id: string
  name: string
  description: string
  parameters: z.ZodTypeAny
  execute: (args: unknown, context: PluginContext) => Promise<unknown>
}

export interface UIPanelDefinition {
  id: string
  location: 'sidebar-top' | 'sidebar-bottom' | 'page' | 'settings-tab' | 'modal'
  icon: string
  label: string
  componentPath: string
}

export interface EnterpriseUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role?: string
  groups?: string[]
}

export interface AuthResult {
  success: boolean
  user?: EnterpriseUser
  token?: string
  error?: string
}

export interface AuthProviderDefinition {
  id: string
  type: 'oauth2' | 'saml' | 'oidc' | 'ldap'
  authenticate: (request: Request) => Promise<AuthResult>
  getUserProfile: (userId: string) => Promise<EnterpriseUser | null>
  logout?: (request: Request) => Promise<void>
}

export interface ThemeDefinition {
  id: string
  variables: Record<string, string>
  assets?: {
    logo?: string
    favicon?: string
  }
}

export interface StorageProviderDefinition {
  id: string
  upload: (key: string, data: Buffer, contentType: string) => Promise<string>
  download: (key: string) => Promise<Buffer>
  delete: (key: string) => Promise<void>
  getPresignedUrl: (key: string, expiresSeconds: number) => Promise<string>
}

export interface AIProviderDefinition {
  id: string
  chat: (request: ChatInferenceRequest) => Promise<ChatInferenceResponse>
  generateImage?: (request: ImageInferenceRequest) => Promise<ImageInferenceResponse>
  generateVideo?: (request: VideoInferenceRequest) => Promise<VideoInferenceResponse>
}

export interface ChatInferenceRequest {
  modelId: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatInferenceResponse {
  content: string
  usage?: { promptTokens: number; completionTokens: number }
}

export interface ImageInferenceRequest {
  modelId: string
  prompt: string
  aspectRatio?: string
}

export interface ImageInferenceResponse {
  url: string
  mimeType: string
  sizeBytes: number
}

export interface VideoInferenceRequest {
  modelId: string
  prompt: string
  duration?: number
  aspectRatio?: string
}

export interface VideoInferenceResponse {
  url: string
  mimeType: string
  sizeBytes: number
  durationSeconds: number
}
