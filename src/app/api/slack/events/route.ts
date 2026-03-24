import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature, postSlackMessage, textToBlocks } from '@/lib/slack'
import { convex } from '@/lib/convex'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { getInternalApiSecret } from '@/lib/internal-api-secret'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const timestamp = request.headers.get('x-slack-request-timestamp') || ''
  const signature = request.headers.get('x-slack-signature') || ''

  if (!verifySlackSignature(body, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  // Slack URL verification challenge
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  if (payload.type !== 'event_callback') {
    return NextResponse.json({ ok: true })
  }

  const event = payload.event
  const teamId = payload.team_id

  // Ignore bot messages
  if (event.bot_id || event.subtype) {
    return NextResponse.json({ ok: true })
  }

  const isDirectMessage = event.type === 'message' && event.channel_type === 'im'
  const isMention = event.type === 'app_mention'

  if (!isDirectMessage && !isMention) {
    return NextResponse.json({ ok: true })
  }

  // Non-blocking: process in background
  processEvent({ event, teamId }).catch((err) =>
    console.error('[Slack Events] Processing error:', err)
  )

  return NextResponse.json({ ok: true })
}

async function processEvent({
  event,
  teamId,
}: {
  event: { type: string; user: string; text: string; channel: string; ts: string; thread_ts?: string }
  teamId: string
}) {
  const serverSecret = getInternalApiSecret()
  // Look up installation
  const installation = await convex.query<{ botToken: string; botUserId: string }>(
    'slack:getInstallation',
    { teamId, serverSecret }
  )
  if (!installation) return

  // Look up user link
  const userLink = await convex.query<{ overlayUserId: string }>(
    'slack:getUserLink',
    { slackUserId: event.user, teamId, serverSecret }
  )

  const userText = event.text.replace(/<@[^>]+>/g, '').trim()
  const threadTs = event.thread_ts || event.ts

  if (!userLink) {
    const baseUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://getoverlay.io')
    await postSlackMessage({
      botToken: installation.botToken,
      channel: event.channel,
      threadTs,
      text: `Hi! Please connect your Overlay account to use AI features: ${baseUrl}/app/slack-connect`,
    })
    return
  }

  // Get conversation history
  const convo = await convex.query<{
    messages: Array<{ role: 'user' | 'assistant'; content: string; ts: string }>
  }>('slack:getConversation', {
    slackChannelId: event.channel,
    slackThreadTs: threadTs,
    serverSecret,
  })

  const history = convo?.messages || []

  // Get user memories
  let memoryContext = ''
  try {
    const memories = await convex.query<Array<{ content: string }>>('memories:list', {
      userId: userLink.overlayUserId,
      serverSecret,
    })
    if (memories && memories.length > 0) {
      memoryContext = '\n\nUser memories:\n' + memories.slice(0, 8).map((m) => `- ${m.content}`).join('\n')
    }
  } catch {
    // optional
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { text: aiResponse } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    system:
      'You are Overlay, a helpful AI assistant in Slack. Be concise and helpful.' + memoryContext,
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userText },
    ],
    maxOutputTokens: 1500,
  })

  await postSlackMessage({
    botToken: installation.botToken,
    channel: event.channel,
    threadTs,
    text: aiResponse,
    blocks: textToBlocks(aiResponse),
  })

  // Save conversation
  const updatedMessages = [
    ...history,
    { role: 'user' as const, content: userText, ts: event.ts },
    { role: 'assistant' as const, content: aiResponse, ts: Date.now().toString() },
  ]
  await convex.mutation('slack:upsertConversation', {
    serverSecret,
    slackChannelId: event.channel,
    slackThreadTs: threadTs,
    overlayUserId: userLink.overlayUserId,
    messages: updatedMessages.slice(-30),
  })
}
