import { validateApiBoundary } from '../_utils/boundary'
import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { convex } from '@/server/database/convex'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'

export async function GET(request: NextRequest) {
  const boundaryError = await validateApiBoundary(request)
  if (boundaryError) return boundaryError
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const projectId = request.nextUrl.searchParams.get('projectId')
    const skills = await convex.query('integrations/skills:list', {
      userId: auth.userId,
      serverSecret,
      projectId: projectId ?? undefined,
    })
    return NextResponse.json(skills || [])
  } catch {
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const boundaryError = await validateApiBoundary(request)
  if (boundaryError) return boundaryError
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const { name, description, instructions, projectId } = body as Record<string, unknown>
    const nameText = typeof name === 'string' ? name.trim() : ''
    const descriptionText = typeof description === 'string' ? description.trim() : ''
    const instructionsText = typeof instructions === 'string' ? instructions.trim() : ''
    if (!nameText || !descriptionText || !instructionsText) {
      return NextResponse.json({ error: 'name, description, and instructions are required' }, { status: 400 })
    }

    const skillId = await convex.mutation<string>('integrations/skills:create', {
      userId: auth.userId,
      serverSecret,
      name: nameText,
      description: descriptionText,
      instructions: instructionsText,
      projectId: projectId ?? undefined,
    })
    return NextResponse.json({ id: skillId })
  } catch {
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const boundaryError = await validateApiBoundary(request)
  if (boundaryError) return boundaryError
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const { skillId, name, description, instructions, enabled } = body as Record<string, unknown>
    if (!skillId) return NextResponse.json({ error: 'skillId required' }, { status: 400 })

    await convex.mutation('integrations/skills:update', {
      skillId,
      userId: auth.userId,
      serverSecret,
      name,
      description,
      instructions,
      enabled,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const boundaryError = await validateApiBoundary(request)
  if (boundaryError) return boundaryError
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

    const skillId = request.nextUrl.searchParams.get('skillId')
    if (!skillId) return NextResponse.json({ error: 'skillId required' }, { status: 400 })

    await convex.mutation('integrations/skills:remove', {
      skillId,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete skill' }, { status: 500 })
  }
}
