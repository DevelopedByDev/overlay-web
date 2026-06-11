import { overlayAppClient } from '@/shared/app/overlay-app-client'

export async function generateTitle(text: string): Promise<string | null> {
  try {
    const res = await overlayAppClient.chat.generateTitleResponse({ text })
    if (res.ok) {
      const data = await res.json()
      return (data.title as string)?.trim() || null
    }
  } catch {
    /* ignore */
  }
  return null
}
