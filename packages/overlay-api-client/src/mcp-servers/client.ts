import type {
  CreateEntityResponse,
  CreateMcpServerRequest,
  McpServerSummary,
  MutationSuccessResponse,
  TestMcpServerRequest,
  TestMcpServerResponse,
  UpdateMcpServerRequest,
} from '@overlay/app-core'
import type { HttpContext } from '../shared/http'
import type { QueryParams } from '../shared/types'
import type { McpServerQuery } from './types'

export class McpServersClient {
  constructor(private readonly http: HttpContext) {}

  private path(query?: McpServerQuery): string {
    return this.http.appendQuery('/api/app/mcps', query as QueryParams | undefined)
  }

  get<T = McpServerSummary[]>(query?: McpServerQuery, init?: RequestInit) {
    return this.http.json<T>(this.path(query), init)
  }

  getResponse(query?: McpServerQuery, init?: RequestInit) {
    return this.http.request(this.path(query), init)
  }

  create(body: CreateMcpServerRequest, init?: RequestInit) {
    return this.http.json<CreateEntityResponse>('/api/app/mcps', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  createResponse(body: CreateMcpServerRequest, init?: RequestInit) {
    return this.http.request('/api/app/mcps', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  update(body: UpdateMcpServerRequest, init?: RequestInit) {
    return this.http.json<MutationSuccessResponse>(
      '/api/app/mcps',
      this.http.jsonRequest(body, { ...init, method: 'PATCH' }),
    )
  }

  updateResponse(body: UpdateMcpServerRequest, init?: RequestInit) {
    return this.http.request('/api/app/mcps', this.http.jsonRequest(body, { ...init, method: 'PATCH' }))
  }

  deleteResponse(query: { mcpServerId: string }, init?: RequestInit) {
    return this.http.request(this.path(query), { ...init, method: 'DELETE' })
  }

  test(body: TestMcpServerRequest, init?: RequestInit) {
    return this.http.json<TestMcpServerResponse>(
      '/api/app/mcps/test',
      this.http.jsonRequest(body, { ...init, method: 'POST' }),
    )
  }

  testResponse(body: TestMcpServerRequest, init?: RequestInit) {
    return this.http.request('/api/app/mcps/test', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }
}
