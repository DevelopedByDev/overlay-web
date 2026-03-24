import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const projectId = request.nextUrl.searchParams.get('projectId')
    const skills = await convex.query('skills:list', {
      userId: session.user.id,
      accessToken: session.accessToken,
      projectId: projectId ?? undefined,
    })
    return NextResponse.json(skills || [])
  } catch {
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, description, instructions, projectId } = await request.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const skillId = await convex.mutation<string>('skills:create', {
      userId: session.user.id,
      accessToken: session.accessToken,
      name,
      description: description || '',
      instructions: instructions || '',
      projectId: projectId ?? undefined,
    })
    return NextResponse.json({ id: skillId })
  } catch {
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { skillId, name, description, instructions } = await request.json()
    if (!skillId) return NextResponse.json({ error: 'skillId required' }, { status: 400 })

    await convex.mutation('skills:update', {
      skillId,
      userId: session.user.id,
      accessToken: session.accessToken,
      name,
      description,
      instructions,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const skillId = request.nextUrl.searchParams.get('skillId')
    if (!skillId) return NextResponse.json({ error: 'skillId required' }, { status: 400 })

    await convex.mutation('skills:remove', {
      skillId,
      userId: session.user.id,
      accessToken: session.accessToken,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete skill' }, { status: 500 })
  }
}
