import ChatInterface from '@/components/app/ChatInterface'
import { getSession } from '@/lib/workos-auth'
import { redirect } from 'next/navigation'

export default async function ChatPage() {
  const session = await getSession()
  if (!session) {
    redirect('/auth/sign-in?redirect=%2Fapp%2Fchat')
  }
  return <ChatInterface userId={session.user.id} />
}
