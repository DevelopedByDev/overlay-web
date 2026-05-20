import type { OnboardingCompleteResponse, OnboardingStatusResponse } from '@overlay/app-core'
import type { HttpContext } from '../shared/http'

export class OnboardingClient {
  constructor(private readonly http: HttpContext) {}

  status(init?: RequestInit) {
    return this.http.json<OnboardingStatusResponse>('/api/app/onboarding/status', init)
  }

  statusResponse(init?: RequestInit) {
    return this.http.request('/api/app/onboarding/status', init)
  }

  complete(body: { accessToken?: string; userId?: string } = {}, init?: RequestInit) {
    return this.http.json<OnboardingCompleteResponse>(
      '/api/app/onboarding/complete',
      this.http.jsonRequest(body, { ...init, method: 'POST' }),
    )
  }

  completeResponse(body: { accessToken?: string; userId?: string } = {}, init?: RequestInit) {
    return this.http.request('/api/app/onboarding/complete', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }

  resetResponse(body: { accessToken?: string; userId?: string } = {}, init?: RequestInit) {
    return this.http.request('/api/app/onboarding/reset', this.http.jsonRequest(body, { ...init, method: 'POST' }))
  }
}
