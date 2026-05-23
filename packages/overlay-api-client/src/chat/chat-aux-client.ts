import type { HttpContext } from '../shared/http'

/** Chat UI helpers (suggestions, title/image/video generation) — distinct from conversation CRUD. */
export class ChatAuxClient {
  constructor(private readonly http: HttpContext) {}

  suggestionsResponse(init?: RequestInit) {
    return this.http.request('/api/app/chat-suggestions', init)
  }

  generateTitleResponse(body: { text?: string; message?: string }, init?: RequestInit) {
    return this.http.request('/api/app/generate-title', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  generateImageResponse(body: Record<string, unknown>, init?: RequestInit) {
    return this.http.request('/api/app/generate-image', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  generateVideoResponse(body: Record<string, unknown>, init?: RequestInit) {
    return this.http.request('/api/app/generate-video', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }
}
