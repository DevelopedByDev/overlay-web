import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import {
  createAppSkill,
  deleteAppSkill,
  listAppSkills,
  updateAppSkill,
} from '@/lib/app-api/skill-service'

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const projectId = request.nextUrl.searchParams.get('projectId')
    return NextResponse.json(
      await listAppSkills(auth.userId, serverSecret, {
        ...(projectId !== null ? { projectId } : {}),
      }),
    )
  } catch {
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const { name, description, instructions, projectId } = body as Record<string, unknown>
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    return NextResponse.json(await createAppSkill({
      userId: auth.userId,
      serverSecret,
      name: String(name),
      ...(typeof description === 'string' ? { description } : {}),
      ...(typeof instructions === 'string' ? { instructions } : {}),
      ...(typeof projectId === 'string' ? { projectId } : {}),
    }))
  } catch {
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()

    const { skillId, name, description, instructions, enabled } = body as Record<string, unknown>
    if (!skillId) return NextResponse.json({ error: 'skillId required' }, { status: 400 })

    return NextResponse.json(await updateAppSkill({
      skillId: String(skillId),
      userId: auth.userId,
      serverSecret,
      ...(typeof name === 'string' ? { name } : {}),
      ...(typeof description === 'string' ? { description } : {}),
      ...(typeof instructions === 'string' ? { instructions } : {}),
      ...(typeof enabled === 'boolean' ? { enabled } : {}),
    }))
  } catch {
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 })
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

    const skillId = request.nextUrl.searchParams.get('skillId')
    if (!skillId) return NextResponse.json({ error: 'skillId required' }, { status: 400 })

    return NextResponse.json(await deleteAppSkill(auth.userId, serverSecret, skillId))
  } catch {
    return NextResponse.json({ error: 'Failed to delete skill' }, { status: 500 })
  }
}
