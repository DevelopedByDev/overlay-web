import type { AICapabilities, AIModel, IAI } from './interface'
import type {
  ChatInferenceRequest,
  ChatInferenceResponse,
  ImageInferenceRequest,
  ImageInferenceResponse,
  VideoInferenceRequest,
  VideoInferenceResponse,
} from './types'

export interface OpenAICompatibleAIOptions {
  providerId: 'openrouter' | 'ollama' | 'vllm' | 'vercel-ai' | 'azure-openai'
  baseUrl: string
  apiKey?: string
  defaultModel: string
  imageEndpoint?: string
  videoEndpoint?: string
  capabilities?: Partial<AICapabilities>
  fetchImpl?: typeof fetch
}

export class OpenAICompatibleAIProvider implements IAI {
  readonly providerId: string
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: OpenAICompatibleAIOptions) {
    this.providerId = options.providerId
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  capabilities(): AICapabilities {
    return {
      chat: true,
      streaming: true,
      vision: false,
      toolCalling: false,
      image: Boolean(this.options.imageEndpoint),
      video: Boolean(this.options.videoEndpoint),
      ...this.options.capabilities,
    }
  }

  async health(): Promise<{ ok: boolean; message?: string; latencyMs?: number }> {
    const start = Date.now()
    const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/models`, {
      headers: this.headers(),
    })
    if (!response.ok) return { ok: false, message: `HTTP ${response.status}`, latencyMs: Date.now() - start }
    return { ok: true, latencyMs: Date.now() - start }
  }

  async chat(request: ChatInferenceRequest): Promise<ChatInferenceResponse> {
    const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.modelId || this.options.defaultModel,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    })
    if (!response.ok) throw new Error(`${this.providerId} chat failed with HTTP ${response.status}: ${await response.text()}`)
    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }> } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const message = json.choices?.[0]?.message
    return {
      content: message?.content ?? '',
      toolCalls: message?.tool_calls?.map((call) => ({
        id: call.id,
        name: call.function?.name ?? '',
        arguments: parseToolArguments(call.function?.arguments),
      })),
      usage: json.usage ? {
        promptTokens: json.usage.prompt_tokens ?? 0,
        completionTokens: json.usage.completion_tokens ?? 0,
        totalTokens: json.usage.total_tokens ?? 0,
      } : undefined,
    }
  }

  async *chatStream(request: ChatInferenceRequest): AsyncGenerator<ChatInferenceResponse, void, unknown> {
    const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.modelId || this.options.defaultModel,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
      }),
    })
    if (!response.ok || !response.body) throw new Error(`${this.providerId} chat stream failed with HTTP ${response.status}`)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (!data || data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
          const content = parsed.choices?.[0]?.delta?.content
          if (content) yield { content }
        } catch {
          // Ignore malformed provider chunks.
        }
      }
    }
  }

  async generateImage(request: ImageInferenceRequest): Promise<ImageInferenceResponse> {
    if (!this.options.imageEndpoint) throw new Error(`${this.providerId} image generation requires ai.${this.providerId}.imageEndpoint.`)
    const response = await this.fetchImpl(this.options.imageEndpoint, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`${this.providerId} image generation failed with HTTP ${response.status}: ${await response.text()}`)
    return await response.json() as ImageInferenceResponse
  }

  async generateVideo(request: VideoInferenceRequest): Promise<VideoInferenceResponse> {
    if (!this.options.videoEndpoint) throw new Error(`${this.providerId} video generation requires ai.${this.providerId}.videoEndpoint.`)
    const response = await this.fetchImpl(this.options.videoEndpoint, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`${this.providerId} video generation failed with HTTP ${response.status}: ${await response.text()}`)
    return await response.json() as VideoInferenceResponse
  }

  async listModels(): Promise<AIModel[]> {
    const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/models`, {
      headers: this.headers(),
    })
    if (!response.ok) return []
    const json = await response.json() as { data?: Array<{ id: string; owned_by?: string }> }
    return (json.data ?? []).map((model) => ({
      id: model.id,
      name: model.id,
      provider: this.providerId,
      type: 'chat',
      costTier: 0,
      supportsVision: Boolean(this.capabilities().vision),
      supportsReasoning: false,
      supportsToolCalling: Boolean(this.capabilities().toolCalling),
    }))
  }

  private headers(): Record<string, string> {
    return this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}
  }
}

export class VercelAIGatewayProvider extends OpenAICompatibleAIProvider {}
export class OpenRouterProvider extends OpenAICompatibleAIProvider {}
export class OllamaProvider extends OpenAICompatibleAIProvider {}
export class VLLMProvider extends OpenAICompatibleAIProvider {}

function parseToolArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}
