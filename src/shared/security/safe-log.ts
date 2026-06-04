export function summarizeErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Unknown error'
}

export function summarizeToolSetForLog(toolSet: Record<string, unknown>): string {
  return `${Object.keys(toolSet).length} tools`
}

export function summarizeToolIndexMapForLog(toolSet: Record<string, unknown>): string {
  const names = Object.keys(toolSet)
  if (names.length === 0) return '(none)'

  const summarized = names
    .slice(0, 80)
    .map((name, index) => `${index}:${safeToolNameForLog(name)}`)
    .join(', ')

  return names.length > 80
    ? `${summarized}, +${names.length - 80} more`
    : summarized
}

export function summarizeToolInputForLog(input: Record<string, unknown> | undefined): string {
  if (!input) {
    return 'no_input'
  }

  const query = input.query
  if (typeof query === 'string') {
    return `query_length=${query.trim().length}`
  }

  const keys = Object.keys(input)
  return keys.length > 0
    ? `input_keys=${keys.slice(0, 8).join(',')}${keys.length > 8 ? ',…' : ''}`
    : 'empty_input'
}

function safeToolNameForLog(name: string): string {
  return name
    .replace(/[^A-Za-z0-9_.:-]+/g, '_')
    .slice(0, 96)
}
