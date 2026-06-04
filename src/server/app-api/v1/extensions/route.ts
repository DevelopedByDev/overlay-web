import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import {
  extensionPathSegments,
  findOverlayExtensionApiHandler,
  normalizeExtensionPath,
  type OverlayExtensionApiMethod,
} from '@overlay/extension-sdk'
import { overlayExtensionApiExtensions } from '@/extensions/api-registry'

type ExtensionRouteParams = {
  extensionId?: string | string[]
  path?: string | string[]
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function pathParam(value: string | string[] | undefined): string {
  if (!value) return '/'
  return normalizeExtensionPath(value)
}

export async function handleExtensionRequest(
  request: NextRequest,
  context: AppApiRouteContext,
): Promise<Response> {
  const params = await context.params as ExtensionRouteParams
  const extensionId = firstParam(params.extensionId)
  if (!extensionId) {
    return NextResponse.json({ error: 'Extension id required' }, { status: 400 })
  }

  const path = pathParam(params.path)
  const handler = findOverlayExtensionApiHandler(overlayExtensionApiExtensions, {
    extensionId,
    method: request.method,
    path,
  })
  if (!handler) {
    return NextResponse.json({ error: 'Extension route not found' }, { status: 404 })
  }

  return handler.handler(request, {
    extensionId,
    method: request.method.toUpperCase() as OverlayExtensionApiMethod,
    path,
    pathSegments: extensionPathSegments(path),
    userId: context.auth.userId,
    authType: context.auth.authType,
    apiKeyId: context.auth.apiKeyId,
    parsedQuery: context.parsedQuery,
    parsedJson: context.parsedJson,
    parsedFormData: context.parsedFormData,
    capabilities: context.capabilities,
  })
}
