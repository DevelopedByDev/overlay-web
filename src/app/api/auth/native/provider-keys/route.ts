import { NextRequest, NextResponse } from 'next/server'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const

export async function POST(request: NextRequest) {
  void request
  return NextResponse.json(
    {
      error: 'disabled',
      message: 'Native provider key retrieval has been disabled. Clients must use server-mediated model access.',
    },
    { status: 410, headers: NO_STORE_HEADERS }
  )
}
