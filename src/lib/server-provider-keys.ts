const PROVIDER_ENV_VARS: Record<string, string> = {
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  composio: 'COMPOSIO_API_KEY',
  ai_gateway: 'AI_GATEWAY_API_KEY',
  mixpanel: 'MIXPANEL_TOKEN',
}

export async function getServerProviderKey(provider: string): Promise<string | null> {
  const envVarName = PROVIDER_ENV_VARS[provider]
  if (!envVarName) {
    return null
  }

  const value = process.env[envVarName]?.trim()
  return value && value.length > 0 ? value : null
}
