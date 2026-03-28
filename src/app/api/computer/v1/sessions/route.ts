import { NextRequest, NextResponse } from 'next/server'
import { createComputerControlClient } from '@/lib/computer-control-client'
import { isComputerOwnedSessionKey } from '@/lib/computer-openclaw'
import { requireComputerApiContext, getComputerServerSecret } from '@/lib/computer-api-route'

function ensureOwnedSessionKey(sessionKey: string, computerId: string, userId: string) {
  if (!isComputerOwnedSessionKey(sessionKey.trim(), { computerId, userId })) {
    throw new Error('Session does not belong to this computer')
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  const client = createComputerControlClient({
    userId: auth.userId,
    serverSecret: getComputerServerSecret(),
  })

  try {
    const sessionKey = request.nextUrl.searchParams.get('sessionKey')?.trim()
    const includeMessages = request.nextUrl.searchParams.get('messages') === 'true'

    if (sessionKey && includeMessages) {
      ensureOwnedSessionKey(sessionKey, auth.computerId, auth.userId)
      const transcript = await client.getTranscript({
        computerId: auth.computerId,
        sessionKey,
      })
      return NextResponse.json(transcript)
    }

    return NextResponse.json(await client.listSessions(auth.computerId))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch sessions'
    const status = message === 'Session does not belong to this computer' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  const client = createComputerControlClient({
    userId: auth.userId,
    serverSecret: getComputerServerSecret(),
  })

  try {
    const body = (await request.json()) as {
      modelId?: string
      sessionKey?: string
      message?: string
    }

    if (body.message?.trim()) {
      if (!body.sessionKey?.trim()) {
        return NextResponse.json({ error: 'sessionKey required when sending a message' }, { status: 400 })
      }
      ensureOwnedSessionKey(body.sessionKey, auth.computerId, auth.userId)
      const output = await client.sendMessage({
        computerId: auth.computerId,
        sessionKey: body.sessionKey.trim(),
        message: body.message.trim(),
      })
      return NextResponse.json({
        success: true,
        sessionKey: body.sessionKey.trim(),
        output,
      })
    }

    const created = await client.createSession({
      computerId: auth.computerId,
      modelId: body.modelId?.trim() || undefined,
    })
    return NextResponse.json(created)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create or send session message'
    const status = message === 'Session does not belong to this computer' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  const client = createComputerControlClient({
    userId: auth.userId,
    serverSecret: getComputerServerSecret(),
  })

  try {
    const body = (await request.json()) as {
      sessionKey?: string
      modelId?: string
      label?: string
    }

    if (!body.sessionKey?.trim()) {
      return NextResponse.json({ error: 'sessionKey required' }, { status: 400 })
    }
    ensureOwnedSessionKey(body.sessionKey, auth.computerId, auth.userId)

    const result = await client.updateSession({
      computerId: auth.computerId,
      sessionKey: body.sessionKey.trim(),
      modelId: body.modelId?.trim() || undefined,
      label: body.label,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update session'
    const status = message === 'Session does not belong to this computer' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireComputerApiContext(request)
  if (auth instanceof NextResponse) return auth

  const client = createComputerControlClient({
    userId: auth.userId,
    serverSecret: getComputerServerSecret(),
  })

  try {
    const sessionKey = request.nextUrl.searchParams.get('sessionKey')?.trim()
    if (!sessionKey) {
      return NextResponse.json({ error: 'sessionKey required' }, { status: 400 })
    }
    ensureOwnedSessionKey(sessionKey, auth.computerId, auth.userId)
    return NextResponse.json(
      await client.deleteSession({
        computerId: auth.computerId,
        sessionKey,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete session'
    const status = message === 'Session does not belong to this computer' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

