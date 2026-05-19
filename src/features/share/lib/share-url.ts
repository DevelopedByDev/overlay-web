/** Build the public share URL for a chat or file given its share token.
 * Browser-only — relies on `window.location.origin`. Returns `null` outside the browser. */
export function buildSharePageUrl(
  type: 'chat' | 'file',
  token: string | null | undefined,
): string | null {
  if (!token) return null
  if (typeof window === 'undefined') return null
  const segment = type === 'chat' ? 'c' : 'f'
  return `${window.location.origin}/share/${segment}/${token}`
}
