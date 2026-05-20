import type {
  AutomationRunDetail,
  AutomationRunRequest,
  AutomationTestRequest,
} from '@overlay/app-core'
import type { HttpContext } from '../shared/http'

export class AutomationRunsClient {
  constructor(private readonly http: HttpContext) {}

  runResponse(body: AutomationRunRequest, init?: RequestInit) {
    return this.http.request('/api/app/automations/run', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  testResponse(body: AutomationTestRequest, init?: RequestInit) {
    return this.http.request('/api/app/automations/test', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  parseRunDetail(response: Response) {
    return this.http.parseJson<AutomationRunDetail>(response)
  }
}
