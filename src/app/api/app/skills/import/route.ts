import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { convex } from '@/lib/convex'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'
import { parseSkillMarkdown } from '@/lib/skill-markdown'

interface ImportFile {
  filename?: unknown
  content?: unknown
}

interface ExistingSkill {
  name: string
}

function nextAvailableSkillName(name: string, usedNames: Set<string>): string {
  let suffix = 2
  while (usedNames.has(`${name} (${suffix})`.toLowerCase())) {
    suffix += 1
  }

  return `${name} (${suffix})`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const files = Array.isArray(body?.files) ? body.files as ImportFile[] : []
    if (files.length === 0) {
      return NextResponse.json({ error: 'files are required' }, { status: 400 })
    }

    const serverSecret = getInternalApiSecret()
    const existingSkills = await convex.query<ExistingSkill[]>('skills:list', {
      userId: auth.userId,
      serverSecret,
    })
    const usedNames = new Set((existingSkills ?? []).map((skill) => skill.name.toLowerCase()))
    const created: { name: string; id: string }[] = []
    const skipped: { filename: string; reason: string }[] = []

    for (const file of files) {
      const filename = typeof file.filename === 'string' && file.filename.trim()
        ? file.filename.trim()
        : 'skill.md'
      const content = typeof file.content === 'string' ? file.content : ''

      const parsed = parseSkillMarkdown(content)
      if (!parsed.ok) {
        skipped.push({ filename, reason: parsed.error })
        continue
      }

      const normalizedName = parsed.skill.name.toLowerCase()
      if (usedNames.has(normalizedName)) {
        skipped.push({
          filename,
          reason: `Name already exists. Rename to "${nextAvailableSkillName(parsed.skill.name, usedNames)}" and retry.`,
        })
        continue
      }

      const skillId = await convex.mutation<string>('skills:create', {
        userId: auth.userId,
        serverSecret,
        name: parsed.skill.name,
        description: parsed.skill.description,
        instructions: parsed.skill.instructions,
        ...(parsed.skill.enabled !== undefined ? { enabled: parsed.skill.enabled } : {}),
      })

      if (skillId) {
        usedNames.add(normalizedName)
        created.push({ name: parsed.skill.name, id: skillId })
      } else {
        skipped.push({ filename, reason: 'Failed to create skill' })
      }
    }

    return NextResponse.json({ created, skipped })
  } catch {
    return NextResponse.json({ error: 'Failed to import skills' }, { status: 500 })
  }
}
