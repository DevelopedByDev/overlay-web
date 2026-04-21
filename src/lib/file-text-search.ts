/**
 * Case-insensitive substring search with bounded context snippets for lexical file search tools.
 * Match indices are JavaScript string indices (UTF-16 code units), aligned with String.prototype.slice.
 */

export const DEFAULT_CONTEXT_CHARS = 220
export const DEFAULT_MAX_MATCHES_PER_FILE = 30
export const DEFAULT_MAX_TOTAL_SNIPPET_CHARS = 24_000
export const MAX_QUERY_CHARS = 500
export const MAX_FILE_IDS_PER_REQUEST = 64

export type TextSearchMatch = {
  /** Inclusive start index in fullText */
  charStart: number
  /** Exclusive end index in fullText */
  charEnd: number
  snippet: string
}

export type FindSubstringMatchesResult = {
  matches: TextSearchMatch[]
  truncated: boolean
  /** Sum of snippet string lengths returned */
  snippetCharsUsed: number
}

/**
 * Non-overlapping case-insensitive substring matches with context windows.
 * Stops when maxMatches reached or adding another snippet would exceed maxTotalSnippetChars.
 */
export function findSubstringMatchesInText(args: {
  fullText: string
  query: string
  contextChars: number
  maxMatches: number
  maxTotalSnippetChars: number
}): FindSubstringMatchesResult {
  const fullText = args.fullText
  const q = args.query.trim().toLowerCase()
  if (!q || !fullText) {
    return { matches: [], truncated: false, snippetCharsUsed: 0 }
  }

  const lowerText = fullText.toLowerCase()
  const { contextChars, maxMatches, maxTotalSnippetChars } = args
  const matches: TextSearchMatch[] = []
  let snippetCharsUsed = 0
  let searchPos = 0
  let truncated = false

  while (matches.length < maxMatches) {
    const pos = lowerText.indexOf(q, searchPos)
    if (pos === -1) break

    const end = pos + q.length
    const snipStart = Math.max(0, pos - contextChars)
    const snipEnd = Math.min(fullText.length, end + contextChars)
    let snippet = fullText.slice(snipStart, snipEnd)

    const remaining = maxTotalSnippetChars - snippetCharsUsed
    if (snippet.length > remaining) {
      if (matches.length === 0 && remaining > 0) {
        snippet = `${snippet.slice(0, remaining - 20)}… [truncated]`
        truncated = true
      } else {
        truncated = true
        break
      }
    }

    matches.push({
      charStart: pos,
      charEnd: end,
      snippet,
    })
    snippetCharsUsed += snippet.length
    searchPos = end
  }

  return { matches, truncated, snippetCharsUsed }
}

/** Dedupe Convex file ids preserving first-seen order. */
export function dedupeFileIdsPreserveOrder(fileIds: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of fileIds) {
    const t = typeof id === 'string' ? id.trim() : ''
    if (!t) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}
