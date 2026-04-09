import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedAppUser } from '@/lib/app-api-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedAppUser(request, {})
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    const groqApiKey = process.env.GROQ_API_KEY

    if (groqApiKey) {
      const groqFormData = new FormData()
      groqFormData.append('file', audioFile, 'audio.webm')
      groqFormData.append('model', 'whisper-large-v3-turbo')
      groqFormData.append('response_format', 'json')

      const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqApiKey}` },
        body: groqFormData,
      })

      if (!groqResponse.ok) {
        const err = await groqResponse.text()
        console.error('[Transcribe] Groq error:', err)
        return NextResponse.json(
          { error: 'Groq transcription failed. Check GROQ_API_KEY and audio codec support.' },
          { status: 500 }
        )
      }

      const data = await groqResponse.json()
      return NextResponse.json({ text: data.text })
    }

    return NextResponse.json(
      { error: 'No transcription provider configured. Set GROQ_API_KEY.' },
      { status: 500 }
    )
  } catch (error) {
    console.error('[Transcribe API] Error:', error)
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 })
  }
}
