import { action } from './_generated/server'
import { v } from 'convex/values'
import { requireProviderKeysSecret } from './lib/auth'

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

export const getAPIKey = action({
  args: {
    provider: v.string(),
    providerKeysSecret: v.string(),
  },
  handler: async (_ctx, { provider, providerKeysSecret }) => {
    requireProviderKeysSecret(providerKeysSecret)
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
