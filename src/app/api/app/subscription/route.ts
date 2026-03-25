import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const entitlements = await convex.query(
      'usage:getEntitlementsByServer',
      {
        userId: session.user.id,
        serverSecret: getInternalApiSecret(),
      },
      { throwOnError: true },
    )
    if (!entitlements) {
      return NextResponse.json({ error: 'Failed to load subscription' }, { status: 502 })
    }
    return NextResponse.json(entitlements)
  } catch (error) {
    console.error('[app/subscription]', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
