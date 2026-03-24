import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect('/app?error=slack_auth_failed')
  }

  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Slack not configured' }, { status: 500 })
  }

  const redirectUri = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/slack/oauth/callback`
    : `${process.env.NEXTAUTH_URL || 'https://getoverlay.io'}/api/slack/oauth/callback`

  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  const data = await res.json()

  if (!data.ok) {
    console.error('[Slack OAuth] Error:', data.error)
    return NextResponse.redirect('/app?error=slack_auth_failed')
  }

  await convex.mutation('slack:saveInstallation', {
    serverSecret: getInternalApiSecret(),
    teamId: data.team.id,
    teamName: data.team.name,
    botToken: data.access_token,
    botUserId: data.bot_user_id,
    installedBy: data.authed_user?.id || 'unknown',
  })

  return NextResponse.redirect('/app?success=slack_connected')
}
