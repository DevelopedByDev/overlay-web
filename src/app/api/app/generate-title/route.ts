import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { generateText } from 'ai'
import { getGatewayLanguageModel } from '@/lib/ai-gateway'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { text } = await request.json()
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

    const languageModel = await getGatewayLanguageModel('openrouter/free', session.accessToken)

    const { text: title } = await generateText({
      model: languageModel,
      prompt: `Generate a concise 3-6 word title for a conversation that starts with this message. Return only the title, no quotes or punctuation:\n\n${text.slice(0, 500)}`,
      maxTokens: 20,
    })

    return NextResponse.json({ title: title.trim() })
  } catch {
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 })
  }
}
