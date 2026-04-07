import type { OverlayToolsOptions } from './types'

export function toolAuthBody(options: OverlayToolsOptions): {
  userId: string
  accessToken?: string
  serverSecret?: string
} {
  return {
    userId: options.userId,
    accessToken: options.accessToken,
    serverSecret: options.serverSecret,
  }
}

export type InternalApiFetchOpts = {
  method?: 'POST' | 'PATCH' | 'DELETE'
  forwardCookie?: string
}

export async function callInternalApi(
  path: string,
  body: Record<string, unknown>,
  accessToken: string | undefined,
  baseUrl: string | undefined,
  opts?: InternalApiFetchOpts,
): Promise<Response> {
  const method = opts?.method ?? 'POST'
  const forwardCookie = opts?.forwardCookie
  const url = baseUrl ? `${baseUrl}${path}` : path
  return fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(typeof body.serverSecret === 'string' && body.serverSecret
        ? { 'x-internal-api-secret': body.serverSecret }
        : {}),
      ...(forwardCookie ? { Cookie: forwardCookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

export async function callInternalApiGet(
  pathWithQuery: string,
  accessToken: string | undefined,
  baseUrl: string | undefined,
  forwardCookie?: string,
  serverSecret?: string,
  userId?: string,
): Promise<Response> {
  const urlObject = new URL(pathWithQuery, baseUrl ?? 'http://localhost')
  if (serverSecret && userId && !urlObject.searchParams.has('userId')) {
    urlObject.searchParams.set('userId', userId)
  }
  const url = baseUrl
    ? `${baseUrl}${urlObject.pathname}${urlObject.search}`
    : `${urlObject.pathname}${urlObject.search}`
  return fetch(url, {
    method: 'GET',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(serverSecret ? { 'x-internal-api-secret': serverSecret } : {}),
      ...(forwardCookie ? { Cookie: forwardCookie } : {}),
    },
  })
}
