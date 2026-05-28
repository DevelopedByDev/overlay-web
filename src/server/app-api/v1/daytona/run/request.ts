import { posix as pathPosix } from 'node:path'
import type { DaytonaRuntime } from '@/server/ai/sandbox/daytona'

export const MAX_COMMAND_LENGTH = 4096
export const MAX_EXPECTED_OUTPUTS = 10
export const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024

const BANNED_COMMAND_HOSTS: RegExp[] = [
  /\b169\.254\./,
  /\bmetadata\.google\.internal\b/i,
  /\bmetadata\.goog\b/i,
  /\binstance-data\b/i,
  /\b127\.0\.0\.1\b/,
  /\blocalhost\b/i,
  /\b0\.0\.0\.0\b/,
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
  /\b172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/,
]

const MIME_TYPES_BY_EXTENSION = [
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.mp4', 'video/mp4'],
  ['.mov', 'video/quicktime'],
  ['.webm', 'video/webm'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.m4a', 'audio/mp4'],
  ['.pdf', 'application/pdf'],
  ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.ppt', 'application/vnd.ms-powerpoint'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.doc', 'application/msword'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.xls', 'application/vnd.ms-excel'],
  ['.zip', 'application/zip'],
  ['.json', 'application/json'],
  ['.html', 'text/html; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.log', 'text/plain; charset=utf-8'],
  ['.md', 'text/plain; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.ts', 'text/typescript; charset=utf-8'],
  ['.py', 'text/x-python; charset=utf-8'],
] as const

export interface DaytonaRunRequest {
  code?: string
  command: string
  conversationId?: string
  expectedOutputs: string[]
  inputFileIds?: string[]
  runtime: DaytonaRuntime
  task: string
  turnId?: string
}

type DaytonaRequestError = {
  payload: Record<string, unknown>
  status: number
  warning?: { message: string; details: Record<string, unknown> }
}

export type DaytonaRunRequestParseResult =
  | { ok: true; value: DaytonaRunRequest }
  | { ok: false; error: DaytonaRequestError }

export function validateSandboxCommand(command: string): { ok: true } | { ok: false; reason: string } {
  if (command.length > MAX_COMMAND_LENGTH) {
    return { ok: false, reason: `Command exceeds maximum length of ${MAX_COMMAND_LENGTH} characters.` }
  }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(command)) {
    return { ok: false, reason: 'Command contains disallowed control characters.' }
  }
  if (BANNED_COMMAND_HOSTS.some((pattern) => pattern.test(command))) {
    return { ok: false, reason: 'Command references an internal or metadata endpoint.' }
  }
  return { ok: true }
}

export function parseDaytonaRunRequest(body: unknown): DaytonaRunRequestParseResult {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const task = typeof input.task === 'string' ? input.task.trim() : ''
  const runtime = input.runtime
  const command = typeof input.command === 'string' ? input.command.trim() : ''
  const expectedOutputs = Array.isArray(input.expectedOutputs)
    ? input.expectedOutputs.map((value) => String(value))
    : []

  if (!task) return requestError({ error: 'Task is required' }, 400)
  if (runtime !== 'node' && runtime !== 'python') {
    return requestError({ error: 'runtime must be "node" or "python"' }, 400)
  }
  if (!command) return requestError({ error: 'command is required' }, 400)

  const commandValidation = validateSandboxCommand(command)
  if (!commandValidation.ok) {
    return requestError(
      { error: 'invalid_command', message: commandValidation.reason },
      400,
      { message: '[Daytona] rejected command', details: { reason: commandValidation.reason } },
    )
  }
  if (expectedOutputs.length === 0) {
    return requestError({ error: 'expectedOutputs must include at least one path' }, 400)
  }
  if (expectedOutputs.length > MAX_EXPECTED_OUTPUTS) {
    return requestError({ error: `expectedOutputs cannot exceed ${MAX_EXPECTED_OUTPUTS} paths` }, 400)
  }

  return {
    ok: true,
    value: {
      task,
      runtime,
      command,
      expectedOutputs,
      code: typeof input.code === 'string' ? input.code : undefined,
      inputFileIds: Array.isArray(input.inputFileIds)
        ? input.inputFileIds.map((value) => String(value))
        : undefined,
      conversationId: typeof input.conversationId === 'string' ? input.conversationId : undefined,
      turnId: typeof input.turnId === 'string' ? input.turnId : undefined,
    },
  }
}

export function sanitizeFileName(name: string, fallback: string): string {
  const normalized = name
    .trim()
    .split(/[\\/]/)
    .filter(Boolean)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '')

  return normalized || fallback
}

export function resolveExpectedOutputPath(baseDir: string, candidate: string): string {
  const trimmed = candidate.trim()
  if (!trimmed) {
    throw new Error('Expected output paths cannot be empty.')
  }

  const resolved = trimmed.startsWith('/')
    ? pathPosix.normalize(trimmed)
    : pathPosix.normalize(pathPosix.join(baseDir, trimmed))

  if (!resolved.startsWith(baseDir)) {
    throw new Error(`Expected output path escapes the sandbox workspace: ${candidate}`)
  }

  return resolved
}

export function guessMimeType(fileName: string, buffer: Buffer): string | undefined {
  const lower = fileName.toLowerCase()
  const match = MIME_TYPES_BY_EXTENSION.find(([extension]) => lower.endsWith(extension))
  if (match) return match[1]

  const looksText = buffer.length === 0 || !buffer.includes(0)
  return looksText ? 'text/plain; charset=utf-8' : 'application/octet-stream'
}

function requestError(
  payload: Record<string, unknown>,
  status: number,
  warning?: DaytonaRequestError['warning'],
): DaytonaRunRequestParseResult {
  return { ok: false, error: { payload, status, warning } }
}
