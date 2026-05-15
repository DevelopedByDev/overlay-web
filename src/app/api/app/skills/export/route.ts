import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { serializeSkillToMarkdown, skillFilenameFromName } from '@/lib/skill-markdown'

interface SkillDocument {
  _id: string
  name: string
  description: string
  instructions: string
  enabled?: boolean
}

function contentDispositionFilename(filename: string): string {
  return filename.replace(/["\\]/g, '')
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const skillId = request.nextUrl.searchParams.get('skillId')
    if (!skillId) return NextResponse.json({ error: 'skillId required' }, { status: 400 })

    const skill = await convex.query<SkillDocument>('skills:get', {
      skillId,
      userId: auth.userId,
      serverSecret: getInternalApiSecret(),
    })
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })

    const filename = contentDispositionFilename(skillFilenameFromName(skill.name))
    return new Response(serializeSkillToMarkdown(skill), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to export skill' }, { status: 500 })
  }
}
