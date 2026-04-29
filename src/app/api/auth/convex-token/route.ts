import { NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'

export async function GET() {
  const session = await getSession()
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(
    { token: session.accessToken },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

