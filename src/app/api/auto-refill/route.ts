import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, enabled } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
    }

    await convex.mutation('subscriptions:updateAutoRefill', {
      userId,
      enabled
    })

    return NextResponse.json({ success: true, autoRefillEnabled: enabled })
  } catch (error) {
    console.error('Auto-refill update error:', error)
    return NextResponse.json({ error: 'Failed to update auto-refill setting' }, { status: 500 })
  }
}
