import type { ConversationSummary } from '@overlay/app-core'
import type { HttpContext } from '../shared/http'
import type { QueryParams } from '../shared/types'
import type {
  ConversationGetResponse,
  ConversationMessageRequest,
  ConversationQuery,
  CreateConversationRequest,
  CreateConversationResponse,
  UpdateConversationRequest,
} from './types'

export class ConversationsClient {
  constructor(private readonly http: HttpContext) {}

  private path(query?: ConversationQuery): string {
    return this.http.appendQuery('/api/app/conversations', query as QueryParams | undefined)
  }

  get<T = ConversationGetResponse>(query?: ConversationQuery, init?: RequestInit) {
    return this.http.json<T>(this.path(query), init)
  }

  getResponse(query?: ConversationQuery, init?: RequestInit) {
    return this.http.request(this.path(query), init)
  }

  create(body: CreateConversationRequest, init?: RequestInit) {
    return this.http.json<CreateConversationResponse>(
      '/api/app/conversations',
      this.http.jsonRequest(body, { ...init, method: 'POST' }),
    )
  }

  createResponse(body: CreateConversationRequest, init?: RequestInit) {
    return this.http.request('/api/app/conversations', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  update(body: UpdateConversationRequest, init?: RequestInit) {
    return this.http.json<ConversationSummary>(
      '/api/app/conversations',
      this.http.jsonRequest(body, { ...init, method: 'PATCH' }),
    )
  }

  updateResponse(body: UpdateConversationRequest, init?: RequestInit) {
    return this.http.request('/api/app/conversations', this.http.jsonRequest(body, { ...init, method: 'PATCH' }))
  }

  deleteResponse(query: { conversationId: string }, init?: RequestInit) {
    return this.http.request(this.path(query), { ...init, method: 'DELETE' })
  }

  addMessage(body: ConversationMessageRequest, init?: RequestInit) {
    return this.http.json<{ success: boolean; conversationId: string; turnId: string }>(
      '/api/app/conversations/message',
      this.http.jsonRequest(body, { ...init, method: 'POST' }),
    )
  }

  addMessageResponse(body: ConversationMessageRequest, init?: RequestInit) {
    return this.http.request('/api/app/conversations/message', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  deleteMessageResponse(
    body: { conversationId?: string; turnId?: string; accessToken?: string; userId?: string },
    init?: RequestInit,
  ) {
    return this.http.request('/api/app/conversations/message', this.http.jsonRequest(body, { ...init, method: 'DELETE' }))
  }

  stopResponse(
    body: {
      conversationId?: string
      messageId?: string
      partialContent?: string
      partialParts?: Array<Record<string, unknown>>
    },
    init?: RequestInit,
  ) {
    return this.http.request('/api/app/conversations/stop', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }
}
