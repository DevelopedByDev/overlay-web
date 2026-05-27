import { NextRequest, NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/server/tools/internal-api-secret'
import { resolveAuthenticatedAppUser } from '@/server/auth/app-api-auth'
import { convex } from '@/server/database/convex'
import { isHardDeniedGithubTool } from '@/server/tools/github-tools-hard-deny'
import { normalizeGithubRepoAllowlist } from '../../../../../convex/lib/github_repo_allowlist_normalize'
import type { Id } from '../../../../../convex/_generated/dataModel'

const GITHUB_TOOL_SLUG_REGEX = /^GITHUB_[A-Z][A-Z0-9_]*$/
const GITHUB_TOOLS_ENABLED_INPUT_MAX = 500

type ProjectDoc = {
  _id: string
  userId: string
  clientId?: string
  name: string
  instructions?: string
  parentId?: string | null
  githubRepoAllowlist?: string[]
  githubToolsEnabled?: string[]
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
      const project = await convex.query<ProjectDoc | null>('projects/projects:get', {
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

    const projects = await convex.query<ProjectDoc[]>('projects/projects:list', {
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
    const id = await convex.mutation<Id<'projects'>>('projects/projects:create', {
      userId: auth.userId,
      serverSecret,
      clientId: clientId?.trim() || undefined,
      name,
      instructions: instructions?.trim() || undefined,
      parentId: parentId ?? undefined,
    })
    const project = await convex.query<ProjectDoc | null>('projects/projects:get', {
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
      githubRepoAllowlist?: string[]
      githubToolsEnabled?: string[]
      accessToken?: string
      userId?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const serverSecret = getInternalApiSecret()
    const { projectId, name, instructions, parentId, githubRepoAllowlist, githubToolsEnabled } = body
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    // Defense in depth: validate allowlist locally before dispatching to Convex.
    // The body cast above only types the field; a malicious or buggy client could
    // still send a non-array (null, string, prototype gadget, etc.) past JSON.parse.
    if (githubRepoAllowlist !== undefined) {
      if (!Array.isArray(githubRepoAllowlist)) {
        return NextResponse.json(
          { error: 'githubRepoAllowlist must be an array of owner/name strings' },
          { status: 400 },
        )
      }
      // Cap input length before normalization to avoid an O(n) CPU-cost amplifier.
      // The normalizer truncates to 100; bound the input at 200 (some headroom for
      // dedupe). Anything larger is almost certainly user error or abuse.
      if (githubRepoAllowlist.length > 200) {
        return NextResponse.json(
          { error: 'githubRepoAllowlist exceeds maximum length (200 entries)' },
          { status: 400 },
        )
      }
      try {
        normalizeGithubRepoAllowlist(githubRepoAllowlist)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid allowlist'
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    // Validate githubToolsEnabled at the user-facing boundary with strict 400s.
    // The Convex normalizer silently drops invalid/hard-denied entries as a
    // defense-in-depth measure; this route layer rejects so the picker UI can
    // surface specific errors to the user.
    if (githubToolsEnabled !== undefined) {
      if (!Array.isArray(githubToolsEnabled)) {
        return NextResponse.json(
          { error: 'invalid_github_tools_enabled' },
          { status: 400 },
        )
      }
      if (githubToolsEnabled.length > GITHUB_TOOLS_ENABLED_INPUT_MAX) {
        return NextResponse.json(
          { error: 'github_tools_enabled_too_long', limit: GITHUB_TOOLS_ENABLED_INPUT_MAX },
          { status: 400 },
        )
      }
      for (const slug of githubToolsEnabled) {
        if (typeof slug !== 'string' || !GITHUB_TOOL_SLUG_REGEX.test(slug)) {
          return NextResponse.json(
            { error: 'invalid_github_tool_slug', invalid: slug },
            { status: 400 },
          )
        }
        if (isHardDeniedGithubTool(slug)) {
          return NextResponse.json(
            {
              error: 'github_tool_hard_denied',
              slug,
              note: 'This GitHub tool is blocked by policy and cannot be enabled.',
            },
            { status: 400 },
          )
        }
      }
    }

    // Apply regular update if there are non-allowlist fields.
    // throwOnError so a failing mutation surfaces as a 500 to the client
    // instead of being silently swallowed (which would let the stale GET
    // below masquerade as a successful save).
    if (name !== undefined || instructions !== undefined || parentId !== undefined) {
      await convex.mutation('projects/projects:update', {
        projectId: projectId as Id<'projects'>,
        userId: auth.userId,
        serverSecret,
        name,
        instructions,
        parentId: parentId ?? undefined,
      }, { throwOnError: true })
    }

    // Apply allowlist update if present (same rationale as above).
    if (githubRepoAllowlist !== undefined) {
      await convex.mutation('projects/projects:setGithubRepoAllowlist', {
        projectId: projectId as Id<'projects'>,
        userId: auth.userId,
        serverSecret,
        repos: githubRepoAllowlist,
      }, { throwOnError: true })
    }

    // Apply tools-enabled update if present.
    if (githubToolsEnabled !== undefined) {
      await convex.mutation('projects/projects:setGithubToolsEnabled', {
        projectId: projectId as Id<'projects'>,
        userId: auth.userId,
        serverSecret,
        slugs: githubToolsEnabled,
      }, { throwOnError: true })
    }

    const project = await convex.query<ProjectDoc | null>('projects/projects:get', {
      projectId: projectId as Id<'projects'>,
      userId: auth.userId,
      serverSecret,
    })
    return NextResponse.json({ success: true, project })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update project'
    console.error('[api/app/projects PATCH] update failed', { error: message })
    return NextResponse.json({ error: message }, { status: 500 })
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
    const allProjects = await convex.query<Array<{ _id: string; parentId?: string; deletedAt?: number }>>('projects/projects:list', {
      userId: auth.userId,
      serverSecret,
      includeDeleted: true,
    })
    const toDelete = collectDescendants(allProjects || [], projectId)
    // Delete leaves first (reverse order so children before parents)
    for (const id of toDelete.reverse()) {
      await convex.mutation('projects/projects:remove', {
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
