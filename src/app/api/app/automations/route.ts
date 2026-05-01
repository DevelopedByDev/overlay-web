import { NextResponse } from 'next/server'

export async function GET() {
  // Stub — returns empty list until automations are persisted
  return NextResponse.json([])
}
