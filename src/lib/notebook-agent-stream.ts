export function createNotebookTextEmitter(emit: (text: string) => void) {
  let lastEmittedText = ''

  return (text?: string | null) => {
    const normalized = text?.trim() ?? ''
    if (!normalized || normalized === lastEmittedText) return false
    lastEmittedText = normalized
    emit(text ?? '')
    return true
  }
}
