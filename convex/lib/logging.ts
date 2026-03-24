export function summarizeErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Unknown error'
}

export function redactIdentifierForLog(value: string | number | null | undefined): string {
  if (value == null) {
    return 'missing'
  }

  const raw = String(value)
  if (raw.length <= 8) {
    return '[redacted]'
  }

  return `${raw.slice(0, 4)}…${raw.slice(-4)}`
}

export function redactIpForLog(value: string | null | undefined): string {
  if (!value) {
    return 'missing'
  }

  const ipv4 = value.split('.')
  if (ipv4.length === 4) {
    return `${ipv4[0]}.${ipv4[1]}.x.x`
  }

  return '[redacted-ip]'
}

export function summarizeTextForLog(value: string | null | undefined): string {
  if (!value) {
    return 'len=0'
  }

  return `len=${value.length}`
}
