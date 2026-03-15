'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'
import type { AuthUser } from '@/lib/workos-auth'

export default function SlackConnect({
  user,
  slackUserId,
  teamId,
}: {
  user: AuthUser
  slackUserId?: string
  teamId?: string
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleConnect() {
    if (!slackUserId || !teamId) {
      setStatus('error')
      setMessage('Missing Slack user information. Please use the link from Slack.')
      return
    }

    setStatus('loading')
    try {
      const res = await fetch('/api/slack/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackUserId, teamId }),
      })
      if (res.ok) {
        setStatus('success')
        setMessage('Your Overlay account is now connected to Slack. You can close this window.')
      } else {
        throw new Error('Link failed')
      }
    } catch {
      setStatus('error')
      setMessage('Failed to connect. Please try again.')
    }
  }

  return (
    <div className="flex items-center justify-center h-full px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div>
          <h1
            className="text-3xl mb-2"
            style={{ fontFamily: 'var(--font-instrument-serif)' }}
          >
            Connect Slack
          </h1>
          <p className="text-sm text-[#888]">
            Link your Overlay account to use AI features in Slack.
          </p>
        </div>

        <div className="bg-[#f5f5f5] rounded-xl p-4 text-sm text-left space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#525252]">Overlay account</span>
            <span className="font-medium text-[#0a0a0a] truncate ml-2">{user.email}</span>
          </div>
          {slackUserId && (
            <div className="flex items-center justify-between">
              <span className="text-[#525252]">Slack user</span>
              <span className="font-mono text-xs text-[#0a0a0a]">{slackUserId}</span>
            </div>
          )}
        </div>

        {status === 'success' ? (
          <div className="flex items-center gap-2 justify-center text-green-600">
            <CheckCircle size={18} />
            <span className="text-sm">{message}</span>
          </div>
        ) : status === 'error' ? (
          <div className="flex items-center gap-2 justify-center text-red-500">
            <AlertCircle size={18} />
            <span className="text-sm">{message}</span>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={status === 'loading' || !slackUserId || !teamId}
            className="w-full py-2.5 rounded-lg bg-[#0a0a0a] text-[#fafafa] text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-50"
          >
            {status === 'loading' ? 'Connecting...' : 'Connect account'}
          </button>
        )}
      </div>
    </div>
  )
}
