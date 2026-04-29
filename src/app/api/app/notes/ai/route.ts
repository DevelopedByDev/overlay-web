import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      instruction?: string
      selection?: string
      document?: string
      userId?: string
      accessToken?: string
    }
    const auth = await resolveAuthenticatedAppUser(request, body)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const source = (body.selection || body.document || '').trim()
    if (!source) return NextResponse.json({ html: '<p></p>' })

    // Minimal local fallback while the notes surface is being split from chat.
    // It keeps the editor flow usable without minting a separate conversation.
    const instruction = (body.instruction || 'Improve writing').toLowerCase()
    let text = source
    if (instruction.includes('shorter') || instruction.includes('summarize')) {
      text = source.split(/\s+/).slice(0, 80).join(' ')
    } else if (instruction.includes('longer') || instruction.includes('continue')) {
      text = `${source}\n\n${source.split(/[.!?]/).filter(Boolean).slice(-1)[0]?.trim() || 'More detail'}...`
    }

    const html = text
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
      .join('')
    return NextResponse.json({ html })
  } catch (error) {
    console.error('[Notes AI] error:', error)
    return NextResponse.json({ error: 'Failed to run note AI' }, { status: 500 })
  }
}
