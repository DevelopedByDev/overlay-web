// Simple Convex HTTP client for the landing page
// Uses direct HTTP calls since this is a separate project from the Electron app

// Use dev Convex URL in development, production URL in production
const IS_DEV = process.env.NODE_ENV === 'development'

function resolveConvexUrl(): { url: string | undefined; source: string } {
  if (IS_DEV && process.env.DEV_NEXT_PUBLIC_CONVEX_URL) {
    return { url: process.env.DEV_NEXT_PUBLIC_CONVEX_URL, source: 'DEV_NEXT_PUBLIC_CONVEX_URL' }
  }

  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    return { url: process.env.NEXT_PUBLIC_CONVEX_URL, source: 'NEXT_PUBLIC_CONVEX_URL' }
  }

  return { url: undefined, source: 'unset' }
}

const { url: CONVEX_URL, source: CONVEX_URL_SOURCE } = resolveConvexUrl()

if (!CONVEX_URL) {
  console.warn('CONVEX_URL is not set')
} else {
  console.log(
    `[Convex] Using ${IS_DEV ? 'DEV' : 'PROD'} environment: ${CONVEX_URL} (source: ${CONVEX_URL_SOURCE})`
  )
}

interface ConvexResponse<T> {
  status: 'success' | 'error'
  value?: T
  errorMessage?: string
}

async function callConvex<T>(
  type: 'query' | 'mutation' | 'action',
  path: string,
  args: Record<string, unknown>
): Promise<T | null> {
  if (!CONVEX_URL) {
    console.error('CONVEX_URL not configured')
    return null
  }

  const url = CONVEX_URL.replace(/\.cloud\.convex\.cloud$/, '.convex.cloud')
  const endpoint = `${url}/api/${type}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path,
        args,
        format: 'json'
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const data: ConvexResponse<T> = await response.json()

    if (data.status === 'error') {
      console.error(`Convex ${type} error:`, data.errorMessage)
      return null
    }

    return data.value ?? null
  } catch (error) {
    console.error(`Convex ${type} failed:`, error)
    return null
  }
}

export const convex = {
  query: <T>(path: string, args: Record<string, unknown>) => callConvex<T>('query', path, args),
  mutation: <T>(path: string, args: Record<string, unknown>) => callConvex<T>('mutation', path, args),
  action: <T>(path: string, args: Record<string, unknown>) => callConvex<T>('action', path, args)
}
