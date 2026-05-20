import type { AppBootstrapResponse } from '@overlay/app-core'
import type { HttpContext } from '../shared/http'

export class BootstrapClient {
  constructor(private readonly http: HttpContext) {}

  get(init?: RequestInit) {
    return this.http.json<AppBootstrapResponse>('/api/app/bootstrap', init)
  }

  getResponse(init?: RequestInit) {
    return this.http.request('/api/app/bootstrap', init)
  }
}
