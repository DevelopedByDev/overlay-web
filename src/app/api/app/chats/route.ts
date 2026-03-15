import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { createChat, deleteChat, listChats, listMessages } from '@/lib/app-store'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const chatId = searchParams.get('chatId')
    const includeMessages = searchParams.get('messages') === 'true'

    if (chatId && includeMessages) {
      const messages = await convex.query<Array<{
        _id: string
        role: 'user' | 'assistant'
        content: string
      }>>('chats:getMessages', { chatId })

      const fallbackMessages = listMessages(chatId).map((message) => ({
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

    const chats = await convex.query<Array<{
      _id: string
      title: string
      model: string
      lastModified: number
    }>>('chats:list', { userId: session.user.id })

    return NextResponse.json(chats || listChats(session.user.id))
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { title, model } = await request.json()
    const chatId = await convex.mutation<string>('chats:create', {
      userId: session.user.id,
      title: title || 'New Chat',
      model: model || 'claude-sonnet-4-6',
    })

    return NextResponse.json({
      id: chatId || createChat(session.user.id, title || 'New Chat', model || 'claude-sonnet-4-6'),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const chatId = request.nextUrl.searchParams.get('chatId')
    if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 })

    const deleted = await convex.mutation('chats:remove', { chatId })
    if (!deleted) {
      deleteChat(chatId)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 })
  }
}
