import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { createAgent, deleteAgent, listAgents, listAgentMessages } from '@/lib/app-store'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const agentId = searchParams.get('agentId')
    const includeMessages = searchParams.get('messages') === 'true'

    if (agentId && includeMessages) {
      const messages = await convex.query<Array<{
        _id: string
        role: 'user' | 'assistant'
        content: string
      }>>('agents:getMessages', { agentId })

      const fallbackMessages = listAgentMessages(agentId).map((message) => ({
        id: message._id,
        role: message.role,
        parts: [{ type: 'text' as const, text: message.content }],
      }))

      return NextResponse.json({
        messages: (messages || []).map((message) => ({
          id: message._id,
          role: message.role,
          parts: [{ type: 'text' as const, text: message.content }],
        })) || fallbackMessages,
      })
    }

    const agents = await convex.query<Array<{
      _id: string
      title: string
      lastModified: number
    }>>('agents:list', { userId: session.user.id })

    return NextResponse.json(agents || listAgents(session.user.id))
  } catch {
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { title } = await request.json()
    const agentId = await convex.mutation<string>('agents:create', {
      userId: session.user.id,
      title: title || 'New Agent',
    })

    return NextResponse.json({
      id: agentId || createAgent(session.user.id, title || 'New Agent'),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const agentId = request.nextUrl.searchParams.get('agentId')
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    const deleted = await convex.mutation('agents:remove', { agentId })
    if (!deleted) {
      deleteAgent(agentId)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 })
  }
}
