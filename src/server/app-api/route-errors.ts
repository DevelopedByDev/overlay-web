import 'server-only'

import { NextResponse } from 'next/server'
import { logger } from '@/server/observability/logger'

type RouteErrorContext = {
  route: string
  operation: string
  clientMessage: string
  status?: number
  details?: Record<string, unknown>
}

export function handleRouteError(error: unknown, context: RouteErrorContext): NextResponse {
  logger.error(`[${context.route}] ${context.operation} failed`, {
    error,
    ...(context.details ?? {}),
  })
  return NextResponse.json(
    { error: context.clientMessage },
    { status: context.status ?? 500 },
  )
}
