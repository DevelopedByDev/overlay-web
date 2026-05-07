import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { convex } from '@/lib/convex'
import type { Id } from '../../../../../convex/_generated/dataModel'

type ProjectDoc = {
  _id: string
  userId: string
  clientId?: string
  name: string
  instructions?: string
  parentId?: string | null
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

function readBooleanParam(value: string | null): boolean | undefined {
  if (value == null) return undefined
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return undefined
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const projectId = request.nextUrl.searchParams.get('projectId')

    if (projectId) {
      const project = await convex.query<ProjectDoc | null>('projects:get', {
        projectId: projectId as Id<'projects'>,
        userId: auth.userId,
        serverSecret,
      })
      if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(project)
    }

    const updatedSinceParam = request.nextUrl.searchParams.get('updatedSince')
    const updatedSince = updatedSinceParam ? Number(updatedSinceParam) : undefined
    const includeDeleted = readBooleanParam(request.nextUrl.searchParams.get('includeDeleted'))

    const projects = await convex.query<ProjectDoc[]>('projects:list', {
      userId: auth.userId,
      serverSecret,
      ...(Number.isFinite(updatedSince) ? { updatedSince } : {}),
      ...(includeDeleted !== undefined ? { includeDeleted } : {}),
    })
    return NextResponse.json(projects || [])
  } catch {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name?: string
      parentId?: string | null
      instructions?: string
      clientId?: string
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { name, parentId, instructions, clientId } = body
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const id = await convex.mutation<Id<'projects'>>('projects:create', {
      userId: auth.userId,
      serverSecret,
      clientId: clientId?.trim() || undefined,
      name,
      instructions: instructions?.trim() || undefined,
      parentId: parentId ?? undefined,
    })
    const project = await convex.query<ProjectDoc | null>('projects:get', {
      projectId: id,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ id, project })
  } catch {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      projectId?: string
      name?: string
      instructions?: string
      parentId?: string | null
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { projectId, name, instructions, parentId } = body
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    await convex.mutation('projects:update', {
      projectId: projectId as Id<'projects'>,
      userId: auth.userId,
      serverSecret,
      name,
      instructions,
      parentId: parentId ?? undefined,
    })
    const project = await convex.query<ProjectDoc | null>('projects:get', {
      projectId: projectId as Id<'projects'>,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true, project })
  } catch {
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: { accessToken?: string; userId?: string } = {}
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        body = await request.json()
      } catch {
        body = {}
      }
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    // Cascade delete child projects first (Convex mutation handles each project's items)
    const allProjects = await convex.query<Array<{ _id: string; parentId?: string; deletedAt?: number }>>('projects:list', {
      userId: auth.userId,
      serverSecret,
      includeDeleted: true,
    })
    const toDelete = collectDescendants(allProjects || [], projectId)
    // Delete leaves first (reverse order so children before parents)
    for (const id of toDelete.reverse()) {
      await convex.mutation('projects:remove', {
        projectId: id as Id<'projects'>,
        userId: auth.userId,
        serverSecret,
      })
    }
    return NextResponse.json({ success: true, deletedIds: toDelete, deletedAt: Date.now() })
  } catch {
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}

function collectDescendants(
  projects: Array<{ _id: string; parentId?: string }>,
  rootId: string,
): string[] {
  const result: string[] = [rootId]
  const seen = new Set<string>(result)
  for (let index = 0; index < result.length; index += 1) {
    const current = result[index]!
    const children = projects.filter((p) => p.parentId === current)
    for (const child of children) {
      if (seen.has(child._id)) continue
      seen.add(child._id)
      result.push(child._id)
    }
  }
  return result
}
