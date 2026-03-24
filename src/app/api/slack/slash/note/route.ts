import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature, postEphemeral } from '@/lib/slack'
import { convex } from '@/lib/convex'
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
  const userId = params.get('user_id') || ''
  const channelId = params.get('channel_id') || ''
  const text = params.get('text') || ''

  if (!text.trim()) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Usage: `/note <content to save>`',
    })
  }

  processNote({ teamId, userId, channelId, text }).catch((err) =>
    console.error('[/note] Error:', err)
  )

  return NextResponse.json({
    response_type: 'ephemeral',
    text: 'Saving note...',
  })
}

async function processNote({
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
  const serverSecret = getInternalApiSecret()
  const installation = await convex.query<{ botToken: string }>(
    'slack:getInstallation',
    { teamId, serverSecret }
  )
  if (!installation) return

  const userLink = await convex.query<{ overlayUserId: string }>(
    'slack:getUserLink',
    { slackUserId: userId, teamId, serverSecret }
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

  await convex.mutation<string>('notes:create', {
    userId: userLink.overlayUserId,
    serverSecret,
    title: `Slack note — ${new Date().toLocaleDateString()}`,
    content: text,
    tags: ['slack'],
  })

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://getoverlay.io'

  await postEphemeral({
    botToken: installation.botToken,
    channel: channelId,
    userId,
    text: `Note saved. <${baseUrl}/app/notes|View in Overlay>`,
  })
}
