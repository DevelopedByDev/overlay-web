import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { convex } from '@/lib/convex'
import { getInternalApiSecret } from '@/lib/internal-api-secret'

export interface ComputerApiTokenContext {
  computerId: string
  userId: string
  tokenVersion: number
  status: string
  name: string
  region: string
  provisioningStep?: string | null
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.toLowerCase().startsWith('bearer ')) {
    return null
  }
  const token = authHeader.slice(7).trim()
  return token || null
}

function hashComputerApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function resolveAuthenticatedComputer(
  request: NextRequest,
): Promise<ComputerApiTokenContext | null> {
  const token = extractBearerToken(request)
  if (!token) {
    return null
  }

  const serverSecret = getInternalApiSecret()
  const tokenHash = hashComputerApiToken(token)

  const context = await convex.query<ComputerApiTokenContext | null>(
    'computers:resolveComputerApiToken',
    {
      tokenHash,
      serverSecret,
    },
    { throwOnError: true, timeoutMs: 30_000 },
  )

  if (!context) {
    return null
  }

  void convex.mutation(
    'computers:touchComputerApiTokenUse',
    {
      computerId: context.computerId,
      serverSecret,
    },
    { timeoutMs: 30_000 },
  ).catch(() => {})

  return context
}

