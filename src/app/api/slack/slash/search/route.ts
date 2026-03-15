import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature, postEphemeral } from '@/lib/slack'
import { convex } from '@/lib/convex'

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
  const query = params.get('text') || ''

  if (!query.trim()) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Usage: `/search <query>`',
    })
  }

  processSearch({ teamId, userId, channelId, query }).catch((err) =>
    console.error('[/search] Error:', err)
  )

  return NextResponse.json({
    response_type: 'ephemeral',
    text: `Searching for "${query}"...`,
  })
}

async function processSearch({
  teamId,
  userId,
  channelId,
  query,
}: {
  teamId: string
  userId: string
  channelId: string
  query: string
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

  // Fetch notes and memories, do keyword search
  const [notes, memories] = await Promise.all([
    convex.query<Array<{ _id: string; title: string; content: string }>>('notes:list', {
      userId: userLink.overlayUserId,
    }),
    convex.query<Array<{ content: string }>>('memories:list', {
      userId: userLink.overlayUserId,
    }),
  ])

  const lowerQuery = query.toLowerCase()

  const matchingNotes = (notes || [])
    .filter(
      (n) =>
        n.title.toLowerCase().includes(lowerQuery) ||
        n.content.toLowerCase().includes(lowerQuery)
    )
    .slice(0, 5)

  const matchingMemories = (memories || [])
    .filter((m) => m.content.toLowerCase().includes(lowerQuery))
    .slice(0, 5)

  if (matchingNotes.length === 0 && matchingMemories.length === 0) {
    await postEphemeral({
      botToken: installation.botToken,
      channel: channelId,
      userId,
      text: `No results found for "${query}".`,
    })
    return
  }

  const lines: string[] = [`*Search results for "${query}":*`]
  if (matchingNotes.length > 0) {
    lines.push('\n*Notes:*')
    matchingNotes.forEach((n) => lines.push(`• *${n.title}*`))
  }
  if (matchingMemories.length > 0) {
    lines.push('\n*Memories:*')
    matchingMemories.forEach((m) => lines.push(`• ${m.content}`))
  }

  await postEphemeral({
    botToken: installation.botToken,
    channel: channelId,
    userId,
    text: lines.join('\n'),
  })
}
