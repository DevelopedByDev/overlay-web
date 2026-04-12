import {
  DEFAULT_AUTH_REDIRECT,
  DESKTOP_AUTH_REDIRECT_URI,
  SESSION_TRANSFER_DEEP_LINK_PREFIX,
} from './auth-constants'

function isAllowedOverlayRedirect(value: string): boolean {
  return (
    value === DESKTOP_AUTH_REDIRECT_URI ||
    value.startsWith(`${SESSION_TRANSFER_DEEP_LINK_PREFIX}?`)
  )
}

export function sanitizeClientAuthRedirect(value?: string | null): string {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_AUTH_REDIRECT

  if (isAllowedOverlayRedirect(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('/')) {
    return trimmed.startsWith('//') ? DEFAULT_AUTH_REDIRECT : trimmed
  }

  if (typeof window === 'undefined') {
    return DEFAULT_AUTH_REDIRECT
  }

  try {
    const candidate = new URL(trimmed, window.location.origin)
    if (candidate.origin !== window.location.origin) {
      return DEFAULT_AUTH_REDIRECT
    }
    return `${candidate.pathname}${candidate.search}${candidate.hash}` || DEFAULT_AUTH_REDIRECT
  } catch {
    return DEFAULT_AUTH_REDIRECT
  }
}
