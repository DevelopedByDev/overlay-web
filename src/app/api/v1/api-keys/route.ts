import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { handleBffRoute, type BffDomainService } from '../_utils/bff'

const apiKeyManagementUnavailable: BffDomainService = () =>
  NextResponse.json(
    {
      error: 'API key management is not exposed yet.',
      code: 'api_key_management_unavailable',
    },
    { status: 501 },
  )

export async function GET(request: NextRequest) {
  return handleBffRoute(request, {}, apiKeyManagementUnavailable)
}

export async function POST(request: NextRequest) {
  return handleBffRoute(request, {}, apiKeyManagementUnavailable)
}

export async function PATCH(request: NextRequest) {
  return handleBffRoute(request, {}, apiKeyManagementUnavailable)
}

export async function DELETE(request: NextRequest) {
  return handleBffRoute(request, {}, apiKeyManagementUnavailable)
}
