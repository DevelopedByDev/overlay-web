import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'
import { convex } from '@/lib/convex'
import { createChat, deleteChat, listChats, listMessages, updateChat } from '@/lib/app-store'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const chatId = searchParams.get('chatId')
    const includeMessages = searchParams.get('messages') === 'true'
    const projectId = searchParams.get('projectId')

    if (chatId && includeMessages) {
      const messages = await convex.query<Array<{
        _id: string
        role: 'user' | 'assistant'
        content: string
        model?: string
      }>>('chats:getMessages', { chatId })

      const fallbackMessages = listMessages(chatId).map((message) => ({
        id: message._id,
        role: message.role,
        parts: [{ type: 'text' as const, text: message.content }],
        model: message.model,
      }))

      return NextResponse.json({
        messages: (messages || []).map((message) => ({
          id: message._id,
          role: message.role,
          parts: [{ type: 'text' as const, text: message.content }],
          model: message.model,
        })) || fallbackMessages,
      })
    }

    // When filtering by project, use the in-memory store (Convex doesn't track projectId)
    if (projectId !== null) {
      return NextResponse.json(listChats(session.user.id, projectId))
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
    const { title, model, projectId } = await request.json()
    const chatId = await convex.mutation<string>('chats:create', {
      userId: session.user.id,
      title: title || 'New Chat',
      model: model || 'claude-sonnet-4-6',
    })

    const storeId = createChat(session.user.id, title || 'New Chat', model || 'claude-sonnet-4-6', projectId)
    return NextResponse.json({ id: chatId || storeId })
  } catch {
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { chatId, title } = await request.json()
    if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 })
    console.log('[ChatTitle][server] PATCH /api/app/chats received', {
      userId: session.user.id,
      chatId,
      title,
    })

    await convex.mutation('chats:update', { chatId, title })
    updateChat(chatId, { title })
    console.log('[ChatTitle][server] PATCH /api/app/chats applied', {
      chatId,
      title,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ChatTitle][server] Failed to patch chat title', error)
    return NextResponse.json({ error: 'Failed to update chat' }, { status: 500 })
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
