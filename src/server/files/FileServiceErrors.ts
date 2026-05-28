export class FileServiceError extends Error {
  constructor(
    readonly payload: Record<string, unknown>,
    readonly statusCode: number,
    message?: string,
  ) {
    super(message ?? String(payload.error ?? 'File service error'))
    this.name = 'FileServiceError'
  }
}

export function serviceError(payload: Record<string, unknown>, statusCode: number): never {
  throw new FileServiceError(payload, statusCode)
}
