import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/workos-auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    const openAiApiKey = process.env.OPENAI_API_KEY

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

    if (openAiApiKey) {
      const openAiFormData = new FormData()
      openAiFormData.append('file', audioFile, 'audio.webm')
      openAiFormData.append('model', 'whisper-1')
      openAiFormData.append('response_format', 'json')

      const openAiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openAiApiKey}` },
        body: openAiFormData,
      })

      if (!openAiResponse.ok) {
        const err = await openAiResponse.text()
        console.error('[Transcribe] OpenAI error:', err)
        return NextResponse.json(
          { error: 'OpenAI transcription failed. Check OPENAI_API_KEY and audio codec support.' },
          { status: 500 }
        )
      }

      const data = await openAiResponse.json()
      return NextResponse.json({ text: data.text })
    }

    return NextResponse.json(
      { error: 'No transcription provider configured. Set GROQ_API_KEY or OPENAI_API_KEY.' },
      { status: 500 }
    )
  } catch (error) {
    console.error('[Transcribe API] Error:', error)
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 })
  }
}
