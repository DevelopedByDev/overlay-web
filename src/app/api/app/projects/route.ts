import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const projects = await convex.query('projects:list', {
      userId: session.user.id,
      accessToken: session.accessToken,
    })
    return NextResponse.json(projects || [])
  } catch {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { name, parentId } = await request.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const id = await convex.mutation('projects:create', {
      userId: session.user.id,
      accessToken: session.accessToken,
      name,
      parentId: parentId ?? undefined,
    })
    return NextResponse.json({ id })
  } catch {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { projectId, name } = await request.json()
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    await convex.mutation('projects:update', {
      projectId,
      userId: session.user.id,
      accessToken: session.accessToken,
      name,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    // Cascade delete child projects first (Convex mutation handles each project's items)
    const allProjects = await convex.query<Array<{ _id: string; parentId?: string }>>('projects:list', {
      userId: session.user.id,
      accessToken: session.accessToken,
    })
    const toDelete = collectDescendants(allProjects || [], projectId)
    // Delete leaves first (reverse order so children before parents)
    for (const id of toDelete.reverse()) {
      await convex.mutation('projects:remove', {
        projectId: id,
        userId: session.user.id,
        accessToken: session.accessToken,
      })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}

function collectDescendants(
  projects: Array<{ _id: string; parentId?: string }>,
  rootId: string,
): string[] {
  const result: string[] = [rootId]
  const children = projects.filter((p) => p.parentId === rootId)
  for (const child of children) {
    result.push(...collectDescendants(projects, child._id))
  }
  return result
}
