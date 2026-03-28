import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth
  const serverSecret = getComputerServerSecret()

  try {
    const skillId = request.nextUrl.searchParams.get('skillId')
    if (skillId) {
      const skill = await convex.query('skills:get', {
        skillId,
        userId: auth.userId,
        serverSecret,
      })
      if (!skill) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(skill)
    }

    const projectId = request.nextUrl.searchParams.get('projectId')
    return NextResponse.json(
      (await convex.query('skills:list', {
        userId: auth.userId,
        serverSecret,
        projectId: projectId ?? undefined,
      })) ?? [],
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch skills'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

