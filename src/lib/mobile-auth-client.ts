const STORAGE_KEY = 'overlay_mobile_pkce_challenge'

export function persistMobilePkceChallengeFromUrl(searchParams: Pick<URLSearchParams, 'get'> | null): void {
  if (typeof window === 'undefined' || !searchParams) return
  const c = searchParams.get('codeChallenge')?.trim()
  if (!c) return
  try {
    sessionStorage.setItem(STORAGE_KEY, c)
  } catch {
    // ignore quota / private mode
  }
}

export function getStoredMobilePkceChallenge(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() || null
  } catch {
    return null
  }
}

export function clearStoredMobilePkceChallenge(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** PKCE challenge for SSO: prefer current URL (app-opened tab), else session fallback across in-site navigation. */
export function resolveCodeChallengeForSso(searchParams: Pick<URLSearchParams, 'get'> | null): string | null {
  const fromUrl = searchParams?.get('codeChallenge')?.trim()
  if (fromUrl) return fromUrl
  return getStoredMobilePkceChallenge()
}
