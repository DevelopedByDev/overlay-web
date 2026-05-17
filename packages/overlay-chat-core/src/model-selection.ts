export type ModelSelectionMode = 'single' | 'multiple'

export function selectSingleModel(modelId: string, current: string[]): string[] {
  if (current.length === 1 && current[0] === modelId) return current
  return [modelId]
}

export function toggleModelSelection({
  current,
  modelId,
  mode,
  maxSelected = 4,
}: {
  current: string[]
  modelId: string
  mode: ModelSelectionMode
  maxSelected?: number
}): string[] {
  if (mode === 'single') return selectSingleModel(modelId, current)

  const selected = current.includes(modelId)
  if (selected) {
    if (current.length === 1) return current
    return current.filter((id) => id !== modelId)
  }
  if (current.length >= maxSelected) return current
  return [...current, modelId]
}

export function collapseModelSelection(current: string[]): string[] {
  return current.length > 0 ? [current[0]!] : []
}

export function resolvePrimaryModel(current: string[], fallback: string): string {
  return current[0] ?? fallback
}
