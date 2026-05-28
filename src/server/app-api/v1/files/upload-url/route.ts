import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { fileService, fileUploadUrlErrorResponse } from '@/server/files/http'

export async function POST(request: NextRequest, context: AppApiRouteContext) {
  try {
    const { sizeBytes, name, mimeType } = await request.json().catch(() => ({})) as {
      sizeBytes?: number
      name?: string
      mimeType?: string
    }
    const { auth } = context
    const result = await fileService.createUploadUrl({
      userId: auth.userId,
      sizeBytes,
      name,
      mimeType,
    })
    return NextResponse.json(result)
  } catch (error) {
    return fileUploadUrlErrorResponse(error)
  }
}
