import type { OverlayCapability } from '@overlay/app-core'

export const CAPABILITY_LABELS: Record<OverlayCapability, string> = {
  billing: 'Billing',
  sso: 'SSO',
  apiKeys: 'API key management',
  webhooks: 'Webhook management',
  vectorSearch: 'Vector search',
  automations: 'Automation scheduling',
  multiTenant: 'Multi-tenant support',
}

export type CapabilityDisabledError = {
  error: string
  code: 'capability_disabled'
  capability: OverlayCapability
}

function normalizePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function startsWithRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

export function getRequiredCapabilityForRoute(
  method: string,
  pathname: string,
): OverlayCapability | null {
  void method
  const normalizedPath = normalizePath(pathname)

  if (startsWithRoute(normalizedPath, '/api/v1/subscription')) return 'billing'
  if (startsWithRoute(normalizedPath, '/api/v1/webhooks')) return 'webhooks'
  if (startsWithRoute(normalizedPath, '/api/v1/api-keys')) return 'apiKeys'
  if (startsWithRoute(normalizedPath, '/api/v1/automations')) return 'automations'
  if (startsWithRoute(normalizedPath, '/api/v1/memory')) return 'vectorSearch'
  if (normalizedPath === '/api/v1/knowledge/search') return 'vectorSearch'

  return null
}

export function getCapabilityDisabledError(
  capability: OverlayCapability,
): CapabilityDisabledError {
  return {
    error: `${CAPABILITY_LABELS[capability]} is disabled for this deployment.`,
    code: 'capability_disabled',
    capability,
  }
}
