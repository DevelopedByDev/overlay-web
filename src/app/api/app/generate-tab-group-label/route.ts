import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
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

function fallbackLabel(text: string): string {
  const words = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?!.,;:]+$/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
  return words.map((w) => w.replace(/^./, (c) => c.toUpperCase())).join(' ') || 'Overlay chat'
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

    const fallback = fallbackLabel(text)
    const apiKey = await resolveGroqApiKey(auth.accessToken)
    if (!apiKey) {
      return NextResponse.json({ title: fallback })
    }

    const groq = new Groq({ apiKey })
    const userPrompt = `Give a very short Chrome tab group name (at most 3 words, no punctuation) summarizing:\n\n${text.slice(0, 400)}`

    let structuredContent = ''
    try {
      const structuredCompletion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        user: auth.userId,
        temperature: 0,
        max_completion_tokens: 32,
        reasoning_effort: 'low',
        reasoning_format: 'hidden',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'tab_group_label',
            description: 'At most 3 words.',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: {
                  type: 'string',
                  description: '1 to 3 words, no punctuation.',
                },
              },
              required: ['title'],
            },
          },
        },
        messages: [
          {
            role: 'system',
            content:
              'You label Chrome tab groups. Return JSON with a single "title" field. The title must be 1 to 3 words only, no quotes or trailing punctuation.',
          },
          { role: 'user', content: userPrompt },
        ],
      })
      structuredContent = getCompletionContent(structuredCompletion.choices[0]?.message?.content)
    } catch {
      return NextResponse.json({ title: fallback })
    }

    let label = ''
    try {
      const parsed = JSON.parse(structuredContent) as { title?: string }
      if (typeof parsed.title === 'string') label = parsed.title
    } catch {
      return NextResponse.json({ title: fallback })
    }

    const words = label
      .replace(/[.!?,;:]+$/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
    const sanitized = words.join(' ') || fallback

    return NextResponse.json({ title: sanitized })
  } catch (error) {
    console.error('[TabGroupLabel] failed', error)
    return NextResponse.json({ error: 'Failed to generate label' }, { status: 500 })
  }
}
