import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'

export async function POST(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const uploadUrl = await convex.mutation('outputs:generateUploadUrl', {
      userId: auth.userId,
      serverSecret: getComputerServerSecret(),
    })
    return NextResponse.json({ uploadUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create upload URL'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

