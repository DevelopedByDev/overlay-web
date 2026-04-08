import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { getOpenRouterLanguageModel } from '@/lib/ai-gateway'
import { FREE_TIER_AUTO_MODEL_ID } from '@/lib/models'
import { DEFAULT_CHAT_SUGGESTIONS } from '@/lib/chat-suggestions-defaults'
import { getSession } from '@/lib/workos-auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const firstName = session.user.firstName?.trim() ?? ''
    const nameHint = firstName
      ? `The user's first name is ${firstName}. Starters can feel lightly tailored — stay useful and professional, never creepy.`
      : 'The user has not shared a first name. Write varied, broadly useful starters.'

    const model = await getOpenRouterLanguageModel(FREE_TIER_AUTO_MODEL_ID, session.accessToken)

    const result = await generateText({
      model,
      temperature: 0.88,
      maxOutputTokens: 700,
      prompt: `${nameHint}

Generate exactly 4 conversation starter prompts for an AI chat app. Each prompt:
- One clear sentence, 8–22 words
- Specific and actionable
- Cover a mix: coding/tools, learning a concept, writing/communication, and a practical everyday task
- No two prompts on the same narrow topic

Reply with ONLY valid JSON (no markdown fences) in this exact shape:
{"prompts":["...","...","...","..."]}`,
    })

    const raw = result.text.trim()
    const jsonStr = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.warn('[chat-suggestions] JSON parse failed, using defaults')
      return NextResponse.json({ prompts: [...DEFAULT_CHAT_SUGGESTIONS] })
    }

    const promptsUnknown = (parsed as { prompts?: unknown }).prompts
    if (!Array.isArray(promptsUnknown)) {
      return NextResponse.json({ prompts: [...DEFAULT_CHAT_SUGGESTIONS] })
    }

    const strings = promptsUnknown
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .map((p) => p.trim())
      .slice(0, 4)

    const out: string[] = [...strings]
    for (const d of DEFAULT_CHAT_SUGGESTIONS) {
      if (out.length >= 4) break
      if (!out.includes(d)) out.push(d)
    }
    while (out.length < 4) {
      out.push(DEFAULT_CHAT_SUGGESTIONS[out.length % DEFAULT_CHAT_SUGGESTIONS.length]!)
    }

    return NextResponse.json({ prompts: out.slice(0, 4) })
  } catch (err) {
    console.error('[chat-suggestions]', err)
    return NextResponse.json({ prompts: [...DEFAULT_CHAT_SUGGESTIONS] })
  }
}
