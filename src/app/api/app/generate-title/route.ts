import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { sanitizeChatTitle } from '@/lib/chat-title'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'

const TITLE_MODEL = 'nvidia/nemotron-nano-9b-v2'
const FALLBACK_TITLE = 'New Chat'

function extractTitleFromContent(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    const parsed = JSON.parse(trimmed) as { title?: string }
    if (typeof parsed.title === 'string' && parsed.title.trim()) return parsed.title.trim()
  } catch {
    // not JSON
  }
  const line = trimmed.replace(/^["'`""'"'"]+|["'`""'"'"]+$/g, '').split('\n')[0]?.trim() ?? ''
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

    const model = await getGatewayLanguageModel(TITLE_MODEL, auth.accessToken)
    const result = await generateText({
      model,
      system:
        'You write short, precise chat titles. Reply with valid JSON only, one line: {"title":"3 to 6 words"}. No markdown, no trailing punctuation in the title string.',
      temperature: 0.2,
      maxOutputTokens: 80,
      prompt: `Generate a concise title for a conversation that starts with this message:\n\n${text.slice(0, 1200)}\n\nRules:\n- 3 to 6 words\n- Natural title case\n- Grammatically complete\n- Capture the actual topic, not the first words\n- No punctuation at the end\n- Return only JSON in this exact shape: {"title":"..."}`,
    })

    const extracted = extractTitleFromContent(result.text)
    const sanitizedTitle = sanitizeChatTitle(extracted, FALLBACK_TITLE)
    if (sanitizedTitle === FALLBACK_TITLE) {
      console.warn('[ChatTitle][server] Gateway returned unparseable title', result.text)
      return NextResponse.json({ title: null }, { status: 502 })
    }

    return NextResponse.json({ title: sanitizedTitle })
  } catch (error) {
    console.error('[ChatTitle][server] Failed to generate title', error)
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 })
  }
}
