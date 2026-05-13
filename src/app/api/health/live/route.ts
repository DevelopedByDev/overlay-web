import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    kind: 'liveness',
    version: process.env.npm_package_version || '0.1.1',
    timestamp: Date.now(),
  })
}
