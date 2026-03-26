import { callInternalApi, toolAuthBody } from './internal-api'
import type { OverlayToolsOptions } from './types'

export async function executeBrowserRunTask(
  options: OverlayToolsOptions,
  input: {
    task: string
    model?: 'bu-mini' | 'bu-max'
    sessionId?: string
    keepAlive?: boolean
    proxyCountryCode?: string
  },
) {
  const { task, model, sessionId, keepAlive, proxyCountryCode } = input
  try {
    const res = await callInternalApi(
      '/api/app/browser-task',
      {
        task,
        model,
        sessionId,
        keepAlive,
        proxyCountryCode,
        ...toolAuthBody(options),
      },
      options.accessToken,
      options.baseUrl,
      { forwardCookie: options.forwardCookie },
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Browser task failed' }))
      return {
        success: false,
        error:
          (err as { message?: string; error?: string }).message ??
          (err as { message?: string; error?: string }).error ??
          'Browser task failed',
      }
    }
    const data = (await res.json()) as {
      output?: unknown
      sessionId?: string
      liveUrl?: string | null
      status?: string
      costUsd?: string
      billing?: Record<string, unknown>
    }
    return {
      success: true,
      output: data.output,
      sessionId: data.sessionId,
      liveUrl: data.liveUrl ?? null,
      status: data.status,
      costUsd: data.costUsd,
      billing: data.billing,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Browser task failed',
    }
  }
}
