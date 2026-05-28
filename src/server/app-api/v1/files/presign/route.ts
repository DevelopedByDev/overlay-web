import { NextRequest, NextResponse } from 'next/server'
import type { AppApiRouteContext } from '@/server/app-api/bff-context'
import { filePresignErrorResponse, fileService } from '@/server/files/http'

export async function GET(request: NextRequest, context: AppApiRouteContext) {
  try {
    const { auth } = context
    const { searchParams } = request.nextUrl
    const result = await fileService.createPresignedUpload({
      userId: auth.userId,
      name: searchParams.get('name'),
      mimeType: searchParams.get('mimeType') ?? 'application/octet-stream',
      sizeBytesRaw: searchParams.get('sizeBytes'),
    })
    console.log(`[FilesPresign] Generated PUT URL for userId=${auth.userId} key=${result.r2Key} size=${result.maxSizeBytes}B`)
    return NextResponse.json(result)
  } catch (error) {
    return filePresignErrorResponse(error)
  }
}
