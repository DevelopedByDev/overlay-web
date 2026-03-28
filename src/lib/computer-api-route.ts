import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getInternalApiSecret } from '@/lib/internal-api-secret'
import { resolveAuthenticatedComputer, type ComputerApiTokenContext } from '@/lib/computer-api-auth'

export async function requireComputerApiContext(
  request: NextRequest,
): Promise<ComputerApiTokenContext | NextResponse> {
  const context = await resolveAuthenticatedComputer(request)
  if (!context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return context
}

export function getComputerServerSecret(): string {
  return getInternalApiSecret()
}

