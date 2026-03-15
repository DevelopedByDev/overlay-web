import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature, postEphemeral } from '@/lib/slack'
import { convex } from '@/lib/convex'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const timestamp = request.headers.get('x-slack-request-timestamp') || ''
  const signature = request.headers.get('x-slack-signature') || ''

  if (!verifySlackSignature(body, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const params = new URLSearchParams(body)
  const teamId = params.get('team_id') || ''
  const userId = params.get('user_id') || ''
  const channelId = params.get('channel_id') || ''
  const text = params.get('text') || ''

  if (!text.trim()) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Usage: `/ask <your question>`',
    })
  }

  // Immediate ack to Slack (must respond within 3s)
  processAsk({ teamId, userId, channelId, text }).catch((err) =>
    console.error('[/ask] Error:', err)
  )

  return NextResponse.json({
    response_type: 'ephemeral',
    text: 'Thinking...',
  })
}

async function processAsk({
  teamId,
  userId,
  channelId,
  text,
}: {
  teamId: string
  userId: string
  channelId: string
  text: string
}) {
  const installation = await convex.query<{ botToken: string }>(
    'slack:getInstallation',
    { teamId }
  )
  if (!installation) return

  const userLink = await convex.query<{ overlayUserId: string }>(
    'slack:getUserLink',
    { slackUserId: userId, teamId }
  )

  if (!userLink) {
    await postEphemeral({
      botToken: installation.botToken,
      channel: channelId,
      userId,
      text: 'Please connect your Overlay account first: https://getoverlay.io/app/slack-connect',
    })
    return
  }

  let memoryContext = ''
  try {
    const memories = await convex.query<Array<{ content: string }>>('memories:list', {
      userId: userLink.overlayUserId,
    })
    if (memories && memories.length > 0) {
      memoryContext = '\n\nUser memories:\n' + memories.slice(0, 8).map((m) => `- ${m.content}`).join('\n')
    }
  } catch {
    // optional
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { text: answer } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    system: 'You are a helpful AI assistant. Answer concisely.' + memoryContext,
    prompt: text,
    maxOutputTokens: 1000,
  })

  await postEphemeral({
    botToken: installation.botToken,
    channel: channelId,
    userId,
    text: answer,
  })
}
