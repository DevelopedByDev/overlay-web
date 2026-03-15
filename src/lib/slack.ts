import { createHmac, timingSafeEqual } from 'crypto'

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || ''

/**
 * Verify Slack request signature (HMAC-SHA256).
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  if (!SLACK_SIGNING_SECRET) return false

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false

  const sigBase = `v0:${timestamp}:${body}`
  const expected = 'v0=' + createHmac('sha256', SLACK_SIGNING_SECRET).update(sigBase).digest('hex')

  try {
    const a = Buffer.from(expected, 'utf-8')
    const b = Buffer.from(signature, 'utf-8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Post a message to Slack using a bot token.
 */
export async function postSlackMessage(opts: {
  botToken: string
  channel: string
  text: string
  threadTs?: string
  blocks?: object[]
}): Promise<void> {
  const body: Record<string, unknown> = {
    channel: opts.channel,
    text: opts.text,
  }
  if (opts.threadTs) body.thread_ts = opts.threadTs
  if (opts.blocks) body.blocks = opts.blocks

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Slack postMessage failed: ${res.status}`)
  }
}

/**
 * Post an ephemeral (visible only to one user) Slack message.
 */
export async function postEphemeral(opts: {
  botToken: string
  channel: string
  userId: string
  text: string
}): Promise<void> {
  const res = await fetch('https://slack.com/api/chat.postEphemeral', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel: opts.channel, user: opts.userId, text: opts.text }),
  })

  if (!res.ok) {
    throw new Error(`Slack postEphemeral failed: ${res.status}`)
  }
}

/**
 * Fetch recent messages from a Slack channel.
 */
export async function fetchChannelHistory(opts: {
  botToken: string
  channel: string
  limit?: number
}): Promise<Array<{ user?: string; text: string; ts: string }>> {
  const url = new URL('https://slack.com/api/conversations.history')
  url.searchParams.set('channel', opts.channel)
  url.searchParams.set('limit', String(opts.limit ?? 20))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${opts.botToken}` },
  })
  const data = await res.json()
  return data.messages || []
}

/**
 * Format text as Slack Block Kit section blocks.
 */
export function textToBlocks(text: string): object[] {
  const chunkSize = 3000
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  if (chunks.length === 0) chunks.push(text)
  return chunks.map((chunk) => ({
    type: 'section',
    text: { type: 'mrkdwn', text: chunk },
  }))
}
