import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

export async function POST() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const uploadUrl = await convex.mutation('files:generateUploadUrl', {
      userId: session.user.id,
      accessToken: session.accessToken,
    })
    if (!uploadUrl) return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
    return NextResponse.json({ uploadUrl })
  } catch {
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
