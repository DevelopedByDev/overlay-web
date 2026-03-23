import type { OverlayToolsOptions } from './types'

export function toolAuthBody(options: OverlayToolsOptions): { userId: string; accessToken?: string } {
  return { userId: options.userId, accessToken: options.accessToken }
}

export async function callInternalApi(
  path: string,
  body: Record<string, unknown>,
  accessToken: string | undefined,
  baseUrl: string | undefined,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
): Promise<Response> {
  const url = baseUrl ? `${baseUrl}${path}` : path
  return fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  })
}
