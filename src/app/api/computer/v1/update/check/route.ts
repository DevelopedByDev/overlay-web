import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'

export async function POST(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const serverSecret = getComputerServerSecret()
    await convex.mutation('computers:markComputerUpdateCheck', {
      computerId: auth.computerId,
      serverSecret,
    })

    const release = await convex.query('computers:getResolvedComputerRelease', {
      computerId: auth.computerId,
      userId: auth.userId,
      serverSecret,
    })

    return NextResponse.json(release)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check for updates'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
