import type { CreateOverlayAppClientOptions, QueryParams } from './types'

export function appendQuery(path: string, query?: QueryParams): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    params.set(key, String(value))
  }
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

export function toUrl(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) return path
  return new URL(path, baseUrl).toString()
}

export function jsonRequest(body: unknown, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return {
    ...init,
    headers,
    body: JSON.stringify(body),
  }
}

async function mergeHeaders(
  getAuthHeaders: CreateOverlayAppClientOptions['getAuthHeaders'],
  initHeaders: HeadersInit | undefined,
): Promise<Headers> {
  const headers = new Headers()
  const authHeaders = await getAuthHeaders?.()
  new Headers(authHeaders).forEach((value, key) => headers.set(key, value))
  new Headers(initHeaders).forEach((value, key) => headers.set(key, value))
  return headers
}

export async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

export interface HttpContext {
  request(path: string, init?: RequestInit): Promise<Response>
  json<T>(path: string, init?: RequestInit): Promise<T>
  appendQuery: typeof appendQuery
  jsonRequest: typeof jsonRequest
  parseJson: typeof parseJson
}

export function createHttpContext(options: CreateOverlayAppClientOptions): HttpContext {
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis)
  if (!fetchImpl) {
    throw new Error('createOverlayAppClient requires a fetch implementation')
  }

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = await mergeHeaders(options.getAuthHeaders, init.headers)
    const requestInit: RequestInit = {
      ...init,
      headers,
    }
    if (requestInit.credentials === undefined) {
      requestInit.credentials = 'same-origin'
    }
    return fetchImpl(toUrl(options.baseUrl, path), requestInit)
  }

  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    return parseJson<T>(await request(path, init))
  }

  return {
    request,
    json,
    appendQuery,
    jsonRequest,
    parseJson,
  }
}
