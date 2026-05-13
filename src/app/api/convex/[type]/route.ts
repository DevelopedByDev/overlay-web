import { NextResponse } from 'next/server'

type ConvexRequestType = 'query' | 'mutation' | 'action'

function isConvexRequestType(value: string): value is ConvexRequestType {
  return value === 'query' || value === 'mutation' || value === 'action'
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ type: string }> }
) {
  const { type } = await context.params

  if (!isConvexRequestType(type)) {
    return NextResponse.json({ error: 'Invalid Convex request type' }, { status: 404 })
  }

  return NextResponse.json(
    { error: 'Direct Convex HTTP proxying is disabled. Use typed application API routes instead.' },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
