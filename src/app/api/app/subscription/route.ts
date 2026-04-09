import { NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const auth = await resolveAuthenticatedAppUser(request, {})
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const entitlements = await convex.query(
      'usage:getEntitlementsByServer',
      {
        userId: auth.userId,
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
