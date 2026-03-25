import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import Groq from 'groq-sdk'
import { sanitizeChatTitle } from '@/lib/chat-title'
import { getServerProviderKey } from '@/lib/server-provider-keys'

async function resolveGroqApiKey(accessToken?: string): Promise<string | null> {
  if (accessToken) {
    const serverKey = await getServerProviderKey('groq')
    if (serverKey) {
      return serverKey
    }
  }

  return process.env.GROQ_API_KEY ?? null
}

function fallbackTitleFromFirstMessage(text: string): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?!.,;:]+$/g, '')

  const withoutPrefix = cleaned.replace(
    /^(please\s+)?(can you|could you|would you|will you|give me|tell me|show me|help me|explain|write|draft|create|make|summari[sz]e)\s+/i,
    ''
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

function getCompletionContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part) {
        const text = (part as { text?: string }).text
        return typeof text === 'string' ? text : ''
      }
      return ''
    })
    .join('')
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { text } = await request.json()
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })
    const fallbackTitle = fallbackTitleFromFirstMessage(text)
    console.log('[ChatTitle][server] Generating title', {
      userId: session.user.id,
      textPreview: text.slice(0, 120),
      textLength: text.length,
      model: 'openai/gpt-oss-20b',
    })

    const apiKey = await resolveGroqApiKey(session.accessToken)
    if (!apiKey) {
      console.warn('[ChatTitle][server] GROQ_API_KEY missing, using fallback title')
      return NextResponse.json({ title: fallbackTitle })
    }

    const groq = new Groq({ apiKey })
    const userPrompt = `Generate a concise 3-6 word title for a conversation that starts with this message:\n\n${text.slice(0, 500)}`

    const structuredCompletion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      user: session.user.id,
      temperature: 0,
      max_completion_tokens: 64,
      reasoning_effort: 'low',
      reasoning_format: 'hidden',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'chat_title',
          description: 'A concise 3-6 word title for a conversation.',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: {
                type: 'string',
                description: 'A concise 3-6 word title with no trailing punctuation.',
              },
            },
            required: ['title'],
          },
        },
      },
      messages: [
        {
          role: 'system',
          content: 'You write short, precise chat titles. Return valid JSON with a single "title" field. The title must be 3 to 6 words, with no quotes or trailing punctuation.',
        },
        { role: 'user', content: userPrompt },
      ],
    })

    const structuredContent = getCompletionContent(structuredCompletion.choices[0]?.message?.content)
    let structuredTitle = ''
    try {
      const parsed = JSON.parse(structuredContent) as { title?: string }
      if (typeof parsed.title === 'string') structuredTitle = parsed.title
    } catch (error) {
      console.error('[ChatTitle][server] Failed to parse structured Groq title payload', {
        structuredContent,
        error,
      })
    }

    let plainTextTitle = ''
    if (!structuredTitle.trim()) {
      const plainTextCompletion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        user: session.user.id,
        temperature: 0.1,
        max_completion_tokens: 64,
        reasoning_effort: 'low',
        reasoning_format: 'hidden',
        messages: [
          {
            role: 'system',
            content: 'You write short, precise chat titles. Reply with only the title in plain text. The title must be 3 to 6 words, with no quotes or trailing punctuation.',
          },
          { role: 'user', content: userPrompt },
        ],
      })

      plainTextTitle = getCompletionContent(plainTextCompletion.choices[0]?.message?.content)
      console.log('[ChatTitle][server] Plain-text Groq retry completed', {
        plainTextTitle,
        finishReason: plainTextCompletion.choices[0]?.finish_reason,
        usage: plainTextCompletion.usage,
        xGroq: plainTextCompletion.x_groq,
      })
    }

    const rawTitle = structuredTitle || plainTextTitle
    const candidateTitle = sanitizeChatTitle(rawTitle, fallbackTitle)
    const usedFallback = shouldUseFallbackTitle(candidateTitle, text)
    const sanitizedTitle = usedFallback ? fallbackTitle : candidateTitle
    console.log('[ChatTitle][server] Title generated', {
      structuredContent,
      structuredTitle,
      plainTextTitle,
      rawTitle,
      candidateTitle,
      sanitizedTitle,
      fallbackTitle,
      usedFallback,
      finishReason: structuredCompletion.choices[0]?.finish_reason,
      usage: structuredCompletion.usage,
      xGroq: structuredCompletion.x_groq,
    })

    return NextResponse.json({ title: sanitizedTitle })
  } catch (error) {
    console.error('[ChatTitle][server] Failed to generate title', error)
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 })
  }
}
