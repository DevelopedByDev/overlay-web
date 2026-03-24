import { convex } from '@/lib/convex'

interface APIKeyResponse {
  key: string | null
}

export async function getServerProviderKey(provider: string): Promise<string | null> {
  const serverSecret = process.env.INTERNAL_API_SECRET?.trim()
  if (!serverSecret) {
    return null
  }

  try {
    const result = await convex.action<APIKeyResponse>('keys:getAPIKey', {
      provider,
      serverSecret,
    })
    return result?.key ?? null
  } catch (error) {
    console.error(`[ProviderKeys] Failed to fetch ${provider} key from Convex`, error)
    return null
  }
}
