'use client'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'overlay:app-sidebar-collapsed'
const SIDEBAR_COLLAPSED_EVENT = 'overlay:sidebar-collapsed-change'

export function getSidebarCollapsedSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function subscribeToSidebarCollapsed(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSED_STORAGE_KEY) onStoreChange()
  }
  const onLocalChange = () => onStoreChange()

  window.addEventListener('storage', onStorage)
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onLocalChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onLocalChange)
  }
}

export function setStoredSidebarCollapsed(next: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? 'true' : 'false')
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT))
  } catch {
    // ignore
  }
}
