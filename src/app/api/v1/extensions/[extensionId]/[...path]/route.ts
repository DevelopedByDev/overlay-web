import type { NextRequest } from 'next/server'
import { handleBffRoute, type BffDomainService } from '../../../_utils/bff'
import { handleExtensionRequest } from '@/server/app-api/v1/extensions/route'

type ExtensionRouteContext = {
  params: Promise<{
    extensionId: string
    path?: string[]
  }>
}

function handleExtensionBffRoute(request: NextRequest, context: ExtensionRouteContext) {
  return handleBffRoute(request, context, handleExtensionRequest as BffDomainService)
}

export async function GET(request: NextRequest, context: ExtensionRouteContext) {
  return handleExtensionBffRoute(request, context)
}

export async function POST(request: NextRequest, context: ExtensionRouteContext) {
  return handleExtensionBffRoute(request, context)
}

export async function PUT(request: NextRequest, context: ExtensionRouteContext) {
  return handleExtensionBffRoute(request, context)
}

export async function PATCH(request: NextRequest, context: ExtensionRouteContext) {
  return handleExtensionBffRoute(request, context)
}

export async function DELETE(request: NextRequest, context: ExtensionRouteContext) {
  return handleExtensionBffRoute(request, context)
}
