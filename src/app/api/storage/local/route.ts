import { NextRequest, NextResponse } from 'next/server'
import { LocalStorage } from '@overlay/core'
import { getStorageProvider } from '@/lib/provider-runtime'

export async function GET(request: NextRequest) {
  const provider = getStorageProvider()
  if (!(provider instanceof LocalStorage)) {
    return NextResponse.json({ error: 'Local storage provider is not enabled.' }, { status: 404 })
  }
  const verified = provider.verifySignedUrl(request.nextUrl)
  if (!verified || verified.method !== 'get') {
    return NextResponse.json({ error: 'Invalid or expired storage URL.' }, { status: 403 })
  }
  const body = await provider.download(verified.key)
  return new NextResponse(new Uint8Array(body))
}

export async function PUT(request: NextRequest) {
  const provider = getStorageProvider()
  if (!(provider instanceof LocalStorage)) {
    return NextResponse.json({ error: 'Local storage provider is not enabled.' }, { status: 404 })
  }
  const verified = provider.verifySignedUrl(request.nextUrl)
  if (!verified || verified.method !== 'put') {
    return NextResponse.json({ error: 'Invalid or expired storage URL.' }, { status: 403 })
  }
  const contentType = request.headers.get('content-type') ?? 'application/octet-stream'
  await provider.upload(verified.key, new Uint8Array(await request.arrayBuffer()), contentType)
  return NextResponse.json({ ok: true })
}
