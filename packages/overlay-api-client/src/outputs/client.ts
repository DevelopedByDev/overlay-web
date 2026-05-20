import type { DeleteOutputResponse, OutputSummary } from '@overlay/app-core'
import type { HttpContext } from '../shared/http'
import type { QueryParams } from '../shared/types'
import type { OutputQuery } from './types'

export class OutputsClient {
  constructor(private readonly http: HttpContext) {}

  private path(query?: OutputQuery): string {
    return this.http.appendQuery('/api/v1/outputs', query as QueryParams | undefined)
  }

  get<T = OutputSummary[]>(query?: OutputQuery, init?: RequestInit) {
    return this.http.json<T>(this.path(query), init)
  }

  getResponse(query?: OutputQuery, init?: RequestInit) {
    return this.http.request(this.path(query), init)
  }

  contentResponse(outputId: string, init?: RequestInit) {
    return this.http.request(`/api/v1/outputs/${encodeURIComponent(outputId)}/content`, init)
  }

  deleteResponse(query: { outputId: string }, init?: RequestInit) {
    return this.http.request(this.path(query), { ...init, method: 'DELETE' })
  }

  parseDeleteResponse(response: Response) {
    return this.http.parseJson<DeleteOutputResponse>(response)
  }
}
