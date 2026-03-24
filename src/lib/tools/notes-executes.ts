import { callInternalApi, callInternalApiGet, toolAuthBody } from './internal-api'
import type { OverlayToolsOptions } from './types'

export async function executeListNotes(
  options: OverlayToolsOptions,
  input: { projectId?: string },
) {
  try {
    const params = new URLSearchParams({ userId: options.userId })
    const projectId = input.projectId ?? options.projectId
    if (projectId) params.set('projectId', projectId)
    const res = await callInternalApiGet(
      `/api/app/notes?${params}`,
      options.accessToken,
      options.baseUrl,
      options.forwardCookie,
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to list notes' }))
      return { success: false, error: (err as { error?: string }).error ?? 'Failed to list notes' }
    }
    const notes = (await res.json()) as Array<{
      _id: string
      title: string
      updatedAt: number
      projectId?: string
    }>
    const slim = notes.map((n) => ({
      noteId: n._id,
      title: n.title,
      updatedAt: n.updatedAt,
      projectId: n.projectId,
    }))
    return { success: true, notes: slim }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list notes',
    }
  }
}

export async function executeGetNote(options: OverlayToolsOptions, input: { noteId: string }) {
  try {
    const params = new URLSearchParams({
      userId: options.userId,
      noteId: input.noteId.trim(),
    })
    const res = await callInternalApiGet(
      `/api/app/notes?${params}`,
      options.accessToken,
      options.baseUrl,
      options.forwardCookie,
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Note not found' }))
      return { success: false, error: (err as { error?: string }).error ?? 'Note not found' }
    }
    const note = (await res.json()) as {
      _id: string
      title: string
      content: string
      tags: string[]
      projectId?: string
      updatedAt: number
    }
    return {
      success: true,
      note: {
        noteId: note._id,
        title: note.title,
        content: note.content,
        tags: note.tags,
        projectId: note.projectId,
        updatedAt: note.updatedAt,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load note',
    }
  }
}

export async function executeCreateNote(
  options: OverlayToolsOptions,
  input: { title?: string; content: string; tags?: string[]; projectId?: string },
) {
  try {
    const res = await callInternalApi(
      '/api/app/notes',
      {
        title: input.title ?? 'Untitled',
        content: input.content,
        tags: input.tags ?? [],
        projectId: input.projectId ?? options.projectId,
        ...toolAuthBody(options),
      },
      options.accessToken,
      options.baseUrl,
      { forwardCookie: options.forwardCookie },
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create note' }))
      return { success: false, error: (err as { error?: string }).error ?? 'Failed to create note' }
    }
    const data = (await res.json()) as { id?: string }
    return { success: true, noteId: data.id }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create note',
    }
  }
}

export async function executeUpdateNote(
  options: OverlayToolsOptions,
  input: { noteId: string; title?: string; content?: string; tags?: string[] },
) {
  try {
    const res = await callInternalApi(
      '/api/app/notes',
      {
        noteId: input.noteId,
        title: input.title,
        content: input.content,
        tags: input.tags,
        ...toolAuthBody(options),
      },
      options.accessToken,
      options.baseUrl,
      { method: 'PATCH', forwardCookie: options.forwardCookie },
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update note' }))
      return { success: false, error: (err as { error?: string }).error ?? 'Failed to update note' }
    }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update note',
    }
  }
}

export async function executeDeleteNote(options: OverlayToolsOptions, input: { noteId: string }) {
  try {
    const url = options.baseUrl
      ? `${options.baseUrl}/api/app/notes?noteId=${encodeURIComponent(input.noteId.trim())}`
      : `/api/app/notes?noteId=${encodeURIComponent(input.noteId.trim())}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        ...(options.forwardCookie ? { Cookie: options.forwardCookie } : {}),
      },
      body: JSON.stringify(toolAuthBody(options)),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete note' }))
      return { success: false, error: (err as { error?: string }).error ?? 'Failed to delete note' }
    }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete note',
    }
  }
}
