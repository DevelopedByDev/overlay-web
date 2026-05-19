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
