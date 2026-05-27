import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from '@/server/ai/sdk'
import { z } from 'zod'
import { sanitizeChatTitle } from '@/shared/chat/chat-title'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { getLanguageModel } from '@/server/ai/model-runtime'
import { enforceRateLimits, getClientIp } from '@/server/security/rate-limit'

const TITLE_MODEL = 'nvidia/nemotron-nano-9b-v2'
const FALLBACK_TITLE = 'New Chat'

const titleSchema = z.object({
  title: z.string().describe('A concise chat title, 3 to 6 words, natural title case, no trailing punctuation'),
})

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      text?: string
      accessToken?: string
      userId?: string
    }
    const { text, accessToken, userId: requestedUserId } = body
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text required' }, { status: 400 })
    }

    const auth = await resolveAuthenticatedAppUser(request, {
      accessToken,
      userId: requestedUserId,
    })
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rateLimitResponse = await enforceRateLimits(request, [
      { bucket: 'helper:title:ip', key: getClientIp(request), limit: 120, windowMs: 10 * 60_000 },
      { bucket: 'helper:title:user', key: auth.userId, limit: 60, windowMs: 10 * 60_000 },
    ])
    if (rateLimitResponse) return rateLimitResponse

    const model = await getLanguageModel(TITLE_MODEL, auth.accessToken)
    const result = await generateObject({
      model,
      schema: titleSchema,
      system:
        'You write short, precise chat titles. Capture the actual topic, not the first words.',
      temperature: 0.2,
      maxOutputTokens: 80,
      prompt: `Generate a concise title for a conversation that starts with this message:\n\n${text.slice(0, 1200)}`,
    })

    const extracted = result.object.title?.trim() ?? ''
    const sanitizedTitle = sanitizeChatTitle(extracted, FALLBACK_TITLE)
    if (sanitizedTitle === FALLBACK_TITLE) {
      console.warn('[ChatTitle][server] Gateway returned empty title', result.object)
      return NextResponse.json({ title: null }, { status: 502 })
    }

    return NextResponse.json({ title: sanitizedTitle })
  } catch (error) {
    console.error('[ChatTitle][server] Failed to generate title', error)
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 })
  }
}
