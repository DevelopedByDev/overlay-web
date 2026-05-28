import type { CapabilityCheck } from '@overlay/app-core'
import type { AuthenticatedAppUser } from '@/server/auth/app-api-auth'

export type AppApiRouteContext = {
  params: Promise<Record<string, string | string[]>>
  auth: AuthenticatedAppUser
  parsedQuery: Record<string, unknown>
  parsedJson: Record<string, unknown>
  parsedFormData: FormData | null
  capabilities: CapabilityCheck
}
