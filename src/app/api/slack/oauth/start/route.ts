import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Slack not configured' }, { status: 500 })
  }

  const scopes = [
    'chat:write',
    'channels:history',
    'groups:history',
    'im:history',
    'im:write',
    'app_mentions:read',
    'commands',
  ].join(',')

  const redirectUri = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/slack/oauth/callback`
    : `${process.env.NEXTAUTH_URL || 'https://getoverlay.io'}/api/slack/oauth/callback`

  const url = new URL('https://slack.com/oauth/v2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', scopes)
  url.searchParams.set('redirect_uri', redirectUri)

  return NextResponse.redirect(url.toString())
}
