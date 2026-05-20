import type {
  BillingSettings,
  Entitlements,
  UpdateBillingSettingsRequest,
} from '@overlay/app-core'
import type { HttpContext } from '../shared/http'

export class SubscriptionClient {
  constructor(private readonly http: HttpContext) {}

  get(init?: RequestInit) {
    return this.http.json<Entitlements>('/api/app/subscription', init)
  }

  getResponse(init?: RequestInit) {
    return this.http.request('/api/app/subscription', init)
  }

  getSettings(init?: RequestInit) {
    return this.http.json<BillingSettings>('/api/subscription/settings', init)
  }

  getSettingsResponse(init?: RequestInit) {
    return this.http.request('/api/subscription/settings', init)
  }

  updateSettings(body: UpdateBillingSettingsRequest, init?: RequestInit) {
    return this.http.json<BillingSettings>(
      '/api/subscription/settings',
      this.http.jsonRequest(body, { ...init, method: 'POST' }),
    )
  }

  updateSettingsResponse(body: UpdateBillingSettingsRequest, init?: RequestInit) {
    return this.http.request('/api/subscription/settings', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }
}
