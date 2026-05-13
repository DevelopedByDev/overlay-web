import type { OverlayConfigType } from '@/lib/config/schema'

const HOSTED_AI = new Set(['vercel-ai', 'openrouter', 'azure-openai'])
const HOSTED_AUTH = new Set(['workos'])
const HOSTED_BILLING = new Set(['stripe'])

export function validateAirGapConfig(config: OverlayConfigType): string[] {
  if (!config.enterprise.airGapped) return []
  const errors: string[] = []

  if (HOSTED_AI.has(config.providers.aiGateway)) {
    errors.push(`Air-gapped mode cannot use hosted AI provider "${config.providers.aiGateway}".`)
  }
  if (HOSTED_AUTH.has(config.providers.auth)) {
    errors.push(`Air-gapped mode cannot use hosted auth provider "${config.providers.auth}".`)
  }
  if (HOSTED_BILLING.has(config.providers.billing)) {
    errors.push(`Air-gapped mode cannot use hosted billing provider "${config.providers.billing}".`)
  }
  if (config.providers.database === 'convex') errors.push('Air-gapped mode cannot use hosted Convex database.')
  if (config.providers.storage === 'r2') errors.push('Air-gapped mode cannot use Cloudflare R2 storage.')

  const externalEnv = [
    'AI_GATEWAY_API_KEY',
    'OPENROUTER_API_KEY',
    'STRIPE_SECRET_KEY',
    'WORKOS_API_KEY',
    'SENTRY_DSN',
    'NEXT_PUBLIC_SENTRY_DSN',
    'NEXT_PUBLIC_POSTHOG_TOKEN',
    'NEXT_PUBLIC_POSTHOG_HOST',
  ].filter((name) => Boolean(process.env[name]?.trim()))
  if (externalEnv.length > 0) {
    errors.push(`Air-gapped mode forbids hosted egress env vars: ${externalEnv.join(', ')}.`)
  }

  return errors
}

export function assertAirGapConfig(config: OverlayConfigType): void {
  const errors = validateAirGapConfig(config)
  if (errors.length > 0) throw new Error(errors.join(' '))
}
