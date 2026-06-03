export const INTEGRATIONS_BC_CHANNEL = 'overlay-integrations'

export function notifyIntegrationsChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('overlay:integrations-changed'))
  try {
    const bc = new BroadcastChannel(INTEGRATIONS_BC_CHANNEL)
    bc.postMessage({ type: 'changed' as const })
    bc.close()
  } catch {
    // BroadcastChannel unsupported or blocked.
  }
}

export function notifyOpenerIntegrationsChanged(): void {
  if (typeof window === 'undefined') return
  try {
    const opener = window.opener as (Window & typeof globalThis) | null
    opener?.dispatchEvent(new CustomEvent('overlay:integrations-changed'))
  } catch {
    // Cross-origin opener.
  }
  notifyIntegrationsChanged()
}
