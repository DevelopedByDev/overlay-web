import { NextRequest, NextResponse } from 'next/server'
import { sanitizeChatTitle } from '@/lib/chat-title'
import { getServerProviderKey } from '@/lib/server-provider-keys'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { openRouterFetchWithRetry, toOpenRouterApiModelId } from '@/lib/openrouter-service'

const TITLE_MODEL = 'openrouter/free'
const FALLBACK_TITLE = 'New Chat'

async function resolveOpenRouterApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    const serverKey = await getServerProviderKey('openrouter')
    if (serverKey) {
      return serverKey
    }
  }
  return process.env.OPENROUTER_API_KEY ?? null
}

function extractTitleFromOpenRouterContent(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    const parsed = JSON.parse(trimmed) as { title?: string }
    if (typeof parsed.title === 'string' && parsed.title.trim()) return parsed.title.trim()
  } catch {
    // not JSON
  }
  const line = trimmed.replace(/^["'`]+|["'`]+$/g, '').split('\n')[0]?.trim() ?? ''
  return line
}

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

    const apiKey = await resolveOpenRouterApiKey(auth.accessToken)
    if (!apiKey) {
      console.warn('[ChatTitle][server] OpenRouter API key missing')
      return NextResponse.json({ title: null }, { status: 503 })
    }

    const userPrompt = `Generate a concise title for a conversation that starts with this message:

${text.slice(0, 1200)}

Rules:
- 3 to 6 words
- Natural title case
- Grammatically complete
- Capture the actual topic, not the first words
- No punctuation at the end
- Return only JSON in this exact shape: {"title":"..."}`.trim()

    const response = await openRouterFetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://getoverlay.io',
        'X-Title': 'Overlay Chat Title',
      },
      body: JSON.stringify({
        model: toOpenRouterApiModelId(TITLE_MODEL),
        temperature: 0.2,
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content:
              'You write short, precise chat titles. Reply with valid JSON only, one line: {"title":"3 to 6 words"}. No markdown, no trailing punctuation in the title string.',
          },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.warn('[ChatTitle][server] OpenRouter title request failed', response.status, errText.slice(0, 200))
      return NextResponse.json({ title: null }, { status: 503 })
    }

    const payload = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string | unknown[] } }>
    }
    const rawContent = payload.choices?.[0]?.message?.content
    const textOut =
      typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent
              .map((p) => (p && typeof p === 'object' && 'text' in p ? String((p as { text?: string }).text ?? '') : ''))
              .join('')
          : ''

    const extracted = extractTitleFromOpenRouterContent(textOut)
    const sanitizedTitle = sanitizeChatTitle(extracted, FALLBACK_TITLE)
    if (sanitizedTitle === FALLBACK_TITLE) {
      return NextResponse.json({ title: null }, { status: 502 })
    }

    return NextResponse.json({ title: sanitizedTitle })
  } catch (error) {
    console.error('[ChatTitle][server] Failed to generate title', error)
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 })
  }
}
