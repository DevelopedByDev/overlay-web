import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { convex } from '@/lib/convex'
import { SharedChatView } from '@/components/share/SharedChatView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SharedMessagePart =
  | { type: 'tool-invocation'; toolInvocation: { toolName: string; state?: string } }
  | { type: string; text?: string; url?: string; mediaType?: string; fileName?: string }

export type SharedConversation = {
  _id: string
  title: string
  createdAt: number
  sharedAt: number
  messages: Array<{
    _id: string
    role: 'user' | 'assistant'
    mode: 'ask' | 'act'
    content: string
    contentType: 'text' | 'image' | 'video'
    parts: SharedMessagePart[] | null
    modelId: string | null
    variantIndex: number
    turnId: string
    createdAt: number
  }>
}

async function loadShared(token: string): Promise<SharedConversation | null> {
  return await convex.query<SharedConversation | null>(
    'conversations:getPublicByToken',
    { token },
    { background: true },
  )
}

function firstUserSnippet(conv: SharedConversation): string {
  const firstUser = conv.messages.find((m) => m.role === 'user')
  if (!firstUser) return ''
  const fromContent = firstUser.content?.trim()
  if (fromContent) return fromContent
  for (const part of firstUser.parts ?? []) {
    if (part.type === 'tool-invocation') continue
    const text = (part as { text?: string }).text
    if (typeof text === 'string' && text.trim()) return text.trim()
  }
  return ''
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
): Promise<Metadata> {
  const { token } = await params
  const conv = await loadShared(token)
  if (!conv) {
    return { title: 'Shared chat — Overlay', robots: { index: false } }
  }
  const description = firstUserSnippet(conv).slice(0, 200) || 'A conversation shared from Overlay.'
  return {
    title: `${conv.title} — Overlay`,
    description,
    openGraph: {
      title: conv.title,
      description,
      type: 'article',
      siteName: 'Overlay',
    },
    twitter: {
      card: 'summary_large_image',
      title: conv.title,
      description,
    },
  }
}

export default async function SharedChatPage(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const conv = await loadShared(token)
  if (!conv) notFound()
  return <SharedChatView conversation={conv} />
}
