import { action } from './_generated/server'
import { v } from 'convex/values'

// Map provider to Convex environment variable name
// These keys are stored directly in Convex environment variables (set via dashboard)
const PROVIDER_ENV_VARS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  xai: 'XAI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  composio: 'COMPOSIO_API_KEY'
}

// Fetch API key for a provider
// Security: The Electron app authenticates via WorkOS OAuth before calling this action
// The accessToken is passed to allow future token validation if needed
export const getAPIKey = action({
  args: {
    provider: v.string(),
    accessToken: v.string()
  },
  handler: async (ctx, { provider, accessToken }) => {
    // Validate that accessToken is present (basic check - user went through OAuth flow)
    if (!accessToken || accessToken.length < 10) {
      console.error('[Convex] Missing or invalid access token')
      return { key: null }
    }

    const envVarName = PROVIDER_ENV_VARS[provider]
    if (!envVarName) {
      console.log(`[Convex] Unknown provider: ${provider}`)
      return { key: null }
    }

    // Get API key from Convex environment variable
    const apiKey = process.env[envVarName]
    if (!apiKey) {
      console.log(`[Convex] No API key configured for ${provider} (env: ${envVarName})`)
      return { key: null }
    }

    console.log(`[Convex] Retrieved key for ${provider}`)
    return { key: apiKey }
  }
})
