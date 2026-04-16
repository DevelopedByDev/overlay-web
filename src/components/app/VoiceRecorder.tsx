'use client'

import { useState, useRef, useCallback } from 'react'
import { Mic, Square, Copy, MessageSquare, BookOpen, Loader2 } from 'lucide-react'
import posthog from 'posthog-js'

type OutputMode = 'clipboard' | 'chat' | 'note'

export default function VoiceRecorder({ userId: _userId }: { userId: string }) {
  void _userId
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [outputMode, setOutputMode] = useState<OutputMode>('clipboard')
  const [status, setStatus] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await transcribe(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setStatus('Recording...')
      posthog.capture('voice_recording_started', { output_mode: outputMode })
    } catch (err) {
      setStatus('Microphone access denied. Please allow microphone access.')
      console.error('[VoiceRecorder] Start error:', err)
    }
  }

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setStatus('')
    }
  }, [isRecording])

  const transcribe = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true)
    setStatus('Transcribing...')
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const res = await fetch('/api/app/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Transcription failed'
        )
      }
      const text = data.text || ''
      setTranscript(text)
      posthog.capture('voice_transcription_completed', {
        output_mode: outputMode,
        transcript_length: text.length,
      })

      if (outputMode === 'clipboard') {
        await navigator.clipboard.writeText(text)
        setStatus('Copied to clipboard.')
      } else if (outputMode === 'note') {
        await saveAsNote(text)
      } else {
        setStatus('Transcription ready. Send to chat below.')
      }
    } catch (err) {
      posthog.capture('voice_transcription_error', {
        output_mode: outputMode,
        error: err instanceof Error ? err.message : 'unknown',
      })
      setStatus(err instanceof Error ? err.message : 'Transcription failed. Please try again.')
      console.error('[VoiceRecorder] Transcribe error:', err)
    } finally {
      setIsTranscribing(false)
    }
  }, [outputMode])

  const saveAsNote = async (text: string) => {
    try {
      const res = await fetch('/api/app/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Voice note — ${new Date().toLocaleString()}`,
          content: text,
          tags: ['voice'],
        }),
      })
      if (res.ok) {
        posthog.capture('voice_saved_as_note', { transcript_length: text.length })
        setStatus('Saved as note.')
      }
    } catch {
      setStatus('Failed to save note.')
    }
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(transcript)
    setStatus('Copied.')
  }

  return (
    <div className="flex flex-col h-full items-center justify-center px-6 max-w-xl mx-auto">
      <div className="w-full space-y-8">
        <div className="text-center">
          <h1
            className="text-3xl mb-2"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Voice
          </h1>
          <p className="text-sm text-[#888]">Record audio and transcribe with AI</p>
        </div>

        {/* Output mode selector */}
        <div className="flex gap-2 justify-center">
          {(['clipboard', 'chat', 'note'] as OutputMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setOutputMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                outputMode === mode
                  ? 'bg-[#0a0a0a] text-[#fafafa]'
                  : 'bg-[#f0f0f0] text-[#525252] hover:bg-[#e8e8e8]'
              }`}
            >
              {mode === 'clipboard' && <Copy size={12} />}
              {mode === 'chat' && <MessageSquare size={12} />}
              {mode === 'note' && <BookOpen size={12} />}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Record button */}
        <div className="flex justify-center">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 scale-105'
                : 'bg-[#0a0a0a] hover:bg-[#333]'
            } disabled:opacity-50`}
          >
            {isTranscribing ? (
              <Loader2 size={28} className="text-white animate-spin" />
            ) : isRecording ? (
              <Square size={24} className="text-white" fill="white" />
            ) : (
              <Mic size={28} className="text-white" />
            )}
          </button>
        </div>

        {/* Status */}
        {status && (
          <p className="text-center text-sm text-[#888]">{status}</p>
        )}

        {/* Transcript */}
        {transcript && (
          <div className="bg-[#f5f5f5] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#525252]">Transcript</span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 text-xs text-[#888] hover:text-[#0a0a0a] transition-colors"
              >
                <Copy size={11} />
                Copy
              </button>
            </div>
            <p className="text-sm text-[#0a0a0a] leading-relaxed whitespace-pre-wrap">{transcript}</p>
          </div>
        )}
      </div>
    </div>
  )
}
