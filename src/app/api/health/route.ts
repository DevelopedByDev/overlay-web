// @enterprise-future — not wired to production
// Lightweight liveness probe. Always returns 200 if the web server is up.

import { NextResponse } from 'next/server'
import { createHandler } from '@/app/api/lib/middleware'

export const GET = createHandler(
  {},
  async () => {
    return NextResponse.json({
      status: 'ok',
      version: process.env.npm_package_version || '0.1.1',
      timestamp: Date.now(),
    })
  },
)
