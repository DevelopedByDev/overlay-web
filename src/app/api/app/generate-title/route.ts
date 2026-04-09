import { NextRequest, NextResponse } from 'next/server'
import { sanitizeChatTitle } from '@/lib/chat-title'
import { getServerProviderKey } from '@/lib/server-provider-keys'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { openRouterFetchWithRetry, toOpenRouterApiModelId } from '@/lib/openrouter-service'

const TITLE_MODEL = 'openrouter/free'

async function resolveOpenRouterApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    const serverKey = await getServerProviderKey('openrouter')
    if (serverKey) {
      return serverKey
    }
  }
  return process.env.OPENROUTER_API_KEY ?? null
}

function fallbackTitleFromFirstMessage(text: string): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?!.,;:]+$/g, '')

  const withoutPrefix = cleaned.replace(
    /^(please\s+)?(can you|could you|would you|will you|give me|tell me|show me|help me|explain|write|draft|create|make|summari[sz]e)\s+/i,
    '',
  )

  const limited = withoutPrefix
    .split(' ')
    .slice(0, 6)
    .join(' ')
    .trim()

  const source = limited || cleaned
  return source.replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeTitleComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function shouldUseFallbackTitle(candidate: string, sourceText: string): boolean {
  const normalizedCandidate = normalizeTitleComparison(candidate)
  const normalizedSource = normalizeTitleComparison(sourceText)

  if (!normalizedCandidate) return true
  if (normalizedCandidate === normalizedSource) return true

  const candidateWords = normalizedCandidate.split(' ').filter(Boolean)
  const sourceWords = normalizedSource.split(' ').filter(Boolean)

  if (candidateWords.length > 8) return true
  if (sourceWords.length > 0 && candidateWords.length >= sourceWords.length - 1) return true
  if (normalizedSource.includes(normalizedCandidate) && normalizedCandidate.length >= normalizedSource.length * 0.7) return true

  return false
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

    const fallbackTitle = fallbackTitleFromFirstMessage(text)
    const apiKey = await resolveOpenRouterApiKey(auth.accessToken)
    if (!apiKey) {
      console.warn('[ChatTitle][server] OpenRouter API key missing, using fallback title')
      return NextResponse.json({ title: fallbackTitle })
    }

    const userPrompt = `Generate a concise 3-6 word title for a conversation that starts with this message:\n\n${text.slice(0, 500)}`

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
              'You write short, precise chat titles. Reply with valid JSON only, one line: {"title":"3 to 6 words"} — no markdown, no trailing punctuation in the title string.',
          },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.warn('[ChatTitle][server] OpenRouter title request failed', response.status, errText.slice(0, 200))
      return NextResponse.json({ title: fallbackTitle })
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
    const candidateTitle = sanitizeChatTitle(extracted, fallbackTitle)
    const usedFallback = shouldUseFallbackTitle(candidateTitle, text)
    const sanitizedTitle = usedFallback ? fallbackTitle : candidateTitle

    return NextResponse.json({ title: sanitizedTitle })
  } catch (error) {
    console.error('[ChatTitle][server] Failed to generate title', error)
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 })
  }
}
