import type { AskModelSelectionMode } from '../chat-interface/types'

export function safeSetLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, value) } catch {}
}

export function toggleModelSelection(current: readonly string[], modelId: string, mode: AskModelSelectionMode, maxModels = 4): string[] {
  if (mode === 'single') return current.length === 1 && current[0] === modelId ? [...current] : [modelId]
  if (current.includes(modelId)) return current.length <= 1 ? [...current] : current.filter((id) => id !== modelId)
  if (current.length >= maxModels) return [...current]
  return [...current, modelId]
}
