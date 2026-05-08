/**
 * Lightweight types + parser for knowledge-agent attachments.
 * Kept separate from the heavy instruction-text module so type-only
 * importers do not drag 20+ KB of prompt strings into bundles.
 */

/** One uploaded document: display name plus ordered Convex file ids (multi-part = split storage). */
export type IndexedAttachmentRef = {
  name: string
  fileIds: string[]
}

/**
 * Normalize request JSON: prefer `indexedAttachments`; fall back to legacy `indexedFileNames` (empty fileIds).
 */
export function parseIndexedAttachmentsFromRequest(body: {
  indexedAttachments?: unknown
  indexedFileNames?: unknown
}): IndexedAttachmentRef[] {
  const out: IndexedAttachmentRef[] = []
  if (Array.isArray(body.indexedAttachments)) {
    for (const item of body.indexedAttachments) {
      if (!item || typeof item !== 'object') continue
      const name =
        typeof (item as { name?: unknown }).name === 'string'
          ? (item as { name: string }).name.trim()
          : ''
      const rawIds = (item as { fileIds?: unknown }).fileIds
      const fileIds = Array.isArray(rawIds)
        ? rawIds
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            .map((id) => id.trim())
        : []
      if (name) out.push({ name, fileIds })
    }
  }
  if (out.length > 0) return out
  const legacy = Array.isArray(body.indexedFileNames)
    ? body.indexedFileNames
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
        .map((n) => n.trim())
    : []
  return legacy.map((name) => ({ name, fileIds: [] as string[] }))
}
