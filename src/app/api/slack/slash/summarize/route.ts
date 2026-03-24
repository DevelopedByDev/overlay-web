import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature, postSlackMessage, fetchChannelHistory } from '@/lib/slack'
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

  const params = new URLSearchParams(body)
  const teamId = params.get('team_id') || ''
  const channelId = params.get('channel_id') || ''

  processSummarize({ teamId, channelId }).catch((err) =>
    console.error('[/summarize] Error:', err)
  )

  return NextResponse.json({
    response_type: 'ephemeral',
    text: 'Summarizing recent messages...',
  })
}

async function processSummarize({
  teamId,
  channelId,
}: {
  teamId: string
  channelId: string
}) {
  const serverSecret = getInternalApiSecret()
  const installation = await convex.query<{ botToken: string }>(
    'slack:getInstallation',
    { teamId, serverSecret }
  )
  if (!installation) return

  const messages = await fetchChannelHistory({
    botToken: installation.botToken,
    channel: channelId,
    limit: 30,
  })

  if (messages.length === 0) {
    await postSlackMessage({
      botToken: installation.botToken,
      channel: channelId,
      text: 'No messages found to summarize.',
    })
    return
  }

  const convoText = messages
    .reverse()
    .map((m) => `${m.user || 'unknown'}: ${m.text}`)
    .join('\n')

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { text: summary } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    system: 'Summarize the following Slack conversation concisely in 3-5 bullet points.',
    prompt: convoText,
    maxOutputTokens: 500,
  })

  await postSlackMessage({
    botToken: installation.botToken,
    channel: channelId,
    text: `*Channel Summary:*\n${summary}`,
  })
}
