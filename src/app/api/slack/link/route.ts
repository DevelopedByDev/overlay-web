import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slackUserId, teamId } = await request.json()
  if (!slackUserId || !teamId) {
    return NextResponse.json({ error: 'slackUserId and teamId required' }, { status: 400 })
  }

  await convex.mutation('slack:linkUser', {
    slackUserId,
    teamId,
    overlayUserId: session.user.id,
  })

  return NextResponse.json({ success: true })
}
