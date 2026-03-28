import { NextRequest, NextResponse } from 'next/server'
import { convex } from '@/lib/convex'
import { getComputerServerSecret, requireComputerApiContext } from '@/lib/computer-api-route'

type UpdateReportBody = {
  status?:
    | 'checking'
    | 'downloading'
    | 'applying'
    | 'restarting'
    | 'verifying'
    | 'ready'
    | 'reprovision_required'
    | 'error'
  targetVersion?: string
  message?: string
  step?: string
  startedAt?: number
  completedAt?: number
}

export async function POST(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = (await request.json()) as UpdateReportBody
    if (!body.status || !body.targetVersion?.trim()) {
      return NextResponse.json({ error: 'status and targetVersion required' }, { status: 400 })
    }

    const result = await convex.mutation('computers:reportComputerUpdate', {
      computerId: auth.computerId,
      serverSecret: getComputerServerSecret(),
      status: body.status,
      targetVersion: body.targetVersion.trim(),
      message: body.message?.trim() || undefined,
      step: body.step?.trim() || undefined,
      startedAt: typeof body.startedAt === 'number' ? body.startedAt : undefined,
      completedAt: typeof body.completedAt === 'number' ? body.completedAt : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to report computer update'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
