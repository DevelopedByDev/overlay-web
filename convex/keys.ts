import { action } from './_generated/server'
import { v } from 'convex/values'

const PROVIDER_ENV_VARS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  xai: 'XAI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  composio: 'COMPOSIO_API_KEY',
  ai_gateway: 'AI_GATEWAY_API_KEY',
  mixpanel: 'MIXPANEL_TOKEN'
}

function validateAccessToken(accessToken: string): boolean {
  if (!accessToken || typeof accessToken !== 'string') return false
  const trimmed = accessToken.trim()
  if (trimmed.length < 20) return false

  // If it looks like a JWT, validate expiry
  const parts = trimmed.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8')
      )
      if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
        return false
      }
    } catch {
      // Not a valid JWT payload — still accept as opaque token
    }
  }

  return true
}

export const getAPIKey = action({
  args: {
    provider: v.string(),
    accessToken: v.string()
  },
  handler: async (_ctx, { provider, accessToken }) => {
    if (!validateAccessToken(accessToken)) {
      console.error('[Convex] Invalid or expired access token')
      return { key: null }
    }

    const envVarName = PROVIDER_ENV_VARS[provider]
    if (!envVarName) {
      return { key: null }
    }

    const apiKey = process.env[envVarName]
    if (!apiKey) {
      return { key: null }
    }

    return { key: apiKey }
  }
})
