/**
 * Pure helpers for splitting file text to fit Convex document limits (no Node crypto/fs).
 */

/** Convex document size limit is 1 MiB; stay under with room for metadata. */
export const MAX_FILE_CONTENT_UTF8_BYTES = 850_000

const textEncoder = new TextEncoder()

export function utf8ByteLength(s: string): number {
  return textEncoder.encode(s).length
}

/**
 * Split long text into multiple parts each under maxBytes (UTF-8), preferring paragraph boundaries.
 */
export function splitTextForConvexDocuments(text: string, maxBytes = MAX_FILE_CONTENT_UTF8_BYTES): string[] {
  if (!text) return []
  if (utf8ByteLength(text) <= maxBytes) return [text]

  const out: string[] = []
  let offset = 0

  while (offset < text.length) {
    const rest = text.slice(offset)
    if (utf8ByteLength(rest) <= maxBytes) {
      out.push(rest)
      break
    }

    let lo = 0
    let hi = rest.length
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2)
      if (utf8ByteLength(rest.slice(0, mid)) <= maxBytes) lo = mid
      else hi = mid - 1
    }

    let cut = Math.max(1, lo)
    const head = rest.slice(0, cut)
    const para = head.lastIndexOf('\n\n')
    const nl = head.lastIndexOf('\n')
    const soft = Math.floor(cut * 0.35)
    if (para >= soft) cut = para + 2
    else if (nl >= soft) cut = nl + 1
    cut = Math.max(1, Math.min(cut, rest.length))

    let piece = rest.slice(0, cut).trimEnd()
    if (!piece) piece = rest.slice(0, cut)

    out.push(piece)
    offset += piece.length
    while (offset < text.length && /\s/.test(text[offset]!)) offset++
  }

  return out.length > 0 ? out : [text.slice(0, 50_000)]
}

/** `report.pdf` + index 2 of 5 → `report (part 2 of 5).pdf` */
export function partedFileName(originalName: string, partIndex: number, totalParts: number): string {
  if (totalParts <= 1) return originalName
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.slice(0, dot) : originalName
  const ext = dot > 0 ? originalName.slice(dot) : ''
  return `${base} (part ${partIndex} of ${totalParts})${ext}`
}
