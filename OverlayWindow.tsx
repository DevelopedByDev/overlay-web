import { useEffect, useRef, useState, useCallback, ReactElement } from 'react'
import { useSettings, PhrasePair } from '../hooks/useSettings'
import { WavEncoder } from '../utils/wav-encoder'
import { Notebook, Mic, MessageCircle, Square, Pause, Play, Globe } from 'lucide-react'

const IDLE_WIDTH = 40
const IDLE_HEIGHT = 8
const EXPANDED_WIDTH = 176
const EXPANDED_HEIGHT = 44
const RECORDING_WIDTH = 70
const RECORDING_HEIGHT = 28
const MIC_RECORDING_WIDTH = EXPANDED_WIDTH
const MIC_RECORDING_HEIGHT = EXPANDED_HEIGHT
const WAVEFORM_BAR_COUNT = 13
const WAVEFORM_BAR_WIDTH = 2.5
const WAVEFORM_BAR_MAX_HEIGHT = 15
const WAVEFORM_GAP = 1.5

// Apply phrase replacements to transcription text
const applyPhraseReplacements = (text: string, phraseReplacements: PhrasePair[]): string => {
  if (!phraseReplacements || phraseReplacements.length === 0) {
    return text
  }

  let result = text
  phraseReplacements.forEach((phrase) => {
    // Use global, case-insensitive replacement
    const regex = new RegExp(phrase.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    result = result.replace(regex, phrase.replacement)
  })
  return result
}

export function OverlayWindow(): ReactElement {
  const { settings } = useSettings()
  const [recording, setRecording] = useState(false)
  const [audioLevels, setAudioLevels] = useState(Array(WAVEFORM_BAR_COUNT).fill(0))
  const [isHovered, setIsHovered] = useState(false)
  const [openPanels, setOpenPanels] = useState<Set<'notebook' | 'chat' | 'browser'>>(new Set())
  const [activePanel, setActivePanel] = useState<'notebook' | 'chat' | 'browser' | null>(null)
  const [showButtons, setShowButtons] = useState(false)
  const [recordingSource, setRecordingSource] = useState<'hotkey' | 'mic' | null>(null)
  const [openingPanel, setOpeningPanel] = useState<'notebook' | 'chat' | 'browser' | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Toggle panel windows - unified hide/show behavior
  // Hides all windows if any are visible, shows all windows if all are hidden
  const togglePanel = async (panel: 'notebook' | 'chat' | 'browser'): Promise<void> => {
    setOpeningPanel(panel)
    setShowButtons(true)

    // For chat/notebook panel opening, check for selected text first
    // Only do this if panels are currently hidden (will be shown)
    const visibilityCheck = await window.bridge.isPanelVisible(panel)
    console.log(`[OverlayWindow] ${panel} visibility check:`, visibilityCheck)

    if (!visibilityCheck.isVisible && (panel === 'chat' || panel === 'notebook')) {
      try {
        const result = await window.bridge.detectSelectedText()
        if (result.success && result.hasSelection && result.selectedText.trim()) {
          // Open panel with selected text
          console.log(`[OverlayWindow] Detected selected text, opening new ${panel}`)
          if (panel === 'chat') {
            await window.bridge.sendTextToNewChat(result.selectedText)
          } else {
            await window.bridge.sendTextToNewNote(result.selectedText)
          }
          setOpenPanels((prev) => new Set(prev).add(panel))
          setActivePanel(panel)
          setOpeningPanel(null)
          setShowButtons(true)
          return
        }
      } catch (error) {
        console.error('[OverlayWindow] Failed to detect selected text:', error)
      }
    }

    // Toggle panel visibility (hide all if any visible, show all if all hidden)
    const toggleResult = await window.bridge.togglePanelWindow(panel, true)
    console.log(`[OverlayWindow] Toggle ${panel} result:`, toggleResult)

    // Update UI state based on whether panels are now visible or hidden
    if (toggleResult.isVisible) {
      // Panels are now visible
      setOpenPanels((prev) => new Set(prev).add(panel))
      setActivePanel(panel)
    } else {
      // Panels are now hidden
      setOpenPanels((prev) => {
        const next = new Set(prev)
        next.delete(panel)
        return next
      })
      if (activePanel === panel) {
        setActivePanel(null)
      }
    }

    setOpeningPanel(null)
    setShowButtons(true)
  }

  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingRef = useRef(false)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const recordingStartTimeRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const wavEncoderRef = useRef<WavEncoder | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)
  const isSettingUpRef = useRef(false) // Track if we're in the middle of setup

  const startRecording = useCallback(async (triggerSource: 'hotkey' | 'mic' = 'hotkey') => {
    console.log(
      'startRecording called with device:',
      settings.inputDevice,
      'source:',
      triggerSource
    )
    if (recordingRef.current || isSettingUpRef.current) return

    setRecordingSource(triggerSource)

    recordingRef.current = true
    isSettingUpRef.current = true
    recordingStartTimeRef.current = Date.now()
    setRecording(true)

    try {
      // Always read the latest settings directly from localStorage
      const savedSettings = localStorage.getItem('dawn-settings')
      const currentSettings = savedSettings ? JSON.parse(savedSettings) : {}
      const currentDevice = currentSettings.inputDevice || 'default'

      console.log('Using device from localStorage:', currentDevice)

      // Use the selected input device from settings
      const audioConstraints: MediaStreamConstraints = {
        audio: currentDevice === 'default' ? true : { deviceId: { exact: currentDevice } }
      }

      streamRef.current = await navigator.mediaDevices.getUserMedia(audioConstraints)

      // Check if recording was canceled during async getUserMedia
      if (!recordingRef.current) {
        console.log('[OverlayWindow] Recording canceled during getUserMedia, cleaning up')
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        isSettingUpRef.current = false
        return
      }
    } catch (error) {
      console.error(
        'Failed to get audio stream with selected device, falling back to default:',
        error
      )

      // Fallback to default device if the selected device is not available
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })

        // Check again if recording was canceled during fallback
        if (!recordingRef.current) {
          console.log('[OverlayWindow] Recording canceled during fallback, cleaning up')
          streamRef.current?.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          isSettingUpRef.current = false
          return
        }
      } catch (fallbackError) {
        console.error('Failed to get any audio stream:', fallbackError)
        recordingRef.current = false
        isSettingUpRef.current = false
        setRecording(false)
        return
      }
    }

    // Final check before setting up audio processing
    if (!recordingRef.current) {
      console.log('[OverlayWindow] Recording canceled before audio setup, cleaning up')
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      isSettingUpRef.current = false
      return
    }

    const audioContext = new AudioContext()
    audioContextRef.current = audioContext
    const source = audioContext.createMediaStreamSource(streamRef.current)
    const analyser = audioContext.createAnalyser()

    analyser.fftSize = 64
    source.connect(analyser)
    analyserRef.current = analyser

    // Check once more if recording was canceled during audio setup
    if (!recordingRef.current) {
      console.log('[OverlayWindow] Recording canceled during audio setup, cleaning up')
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      audioContext.close()
      audioContextRef.current = null
      isSettingUpRef.current = false
      return
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const updateWaveform = () => {
      analyser.getByteFrequencyData(dataArray)
      const levels = Array.from(dataArray.slice(0, WAVEFORM_BAR_COUNT)).map((v) => v / 255)
      setAudioLevels(levels)
      animationRef.current = requestAnimationFrame(updateWaveform)
    }
    updateWaveform()

    // Initialize WAV encoder
    const wavEncoder = new WavEncoder(audioContext.sampleRate, 1) // Mono audio
    wavEncoderRef.current = wavEncoder

    // Create ScriptProcessorNode for recording (4096 buffer size)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    processorNodeRef.current = processor

    processor.onaudioprocess = (e) => {
      if (!recordingRef.current) return

      const inputData = e.inputBuffer.getChannelData(0)
      const buffer = new Float32Array(inputData)
      wavEncoder.addBuffer([buffer])
    }

    // Store source for pause/resume
    sourceRef.current = source

    // Connect audio pipeline: source -> analyser -> processor -> destination
    source.connect(processor)
    processor.connect(audioContext.destination)

    isSettingUpRef.current = false
    setIsPaused(false)
    console.log('[OverlayWindow] Recording setup complete (WAV format)')
  }, []) // No dependencies needed since we read from localStorage

  const togglePause = useCallback(() => {
    if (!recording) return

    if (isPaused) {
      // Resume: reconnect audio processing
      if (sourceRef.current && processorNodeRef.current && analyserRef.current) {
        sourceRef.current.connect(analyserRef.current)
        sourceRef.current.connect(processorNodeRef.current)
      }
      setIsPaused(false)
      console.log('[OverlayWindow] Recording resumed')
    } else {
      // Pause: disconnect audio processing (but keep stream alive)
      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }
      // Reset audio levels to show paused state
      setAudioLevels(Array(WAVEFORM_BAR_COUNT).fill(0.1))
      setIsPaused(true)
      console.log('[OverlayWindow] Recording paused')
    }
  }, [recording, isPaused])

  async function stopRecording() {
    if (!recordingRef.current) return

    // Store current recording source before resetting
    const currentRecordingSource = recordingSource

    recordingRef.current = false
    isSettingUpRef.current = false
    setRecording(false)
    setRecordingSource(null)
    setIsPaused(false)
    setIsProcessing(true) // Show processing animation

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    // Disconnect processor node
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect()
      processorNodeRef.current = null
    }

    // Stop microphone immediately to prevent it from staying active
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log('[OverlayWindow] Stopped track:', track.kind, track.label)
      })
      streamRef.current = null
    }

    const duration = recordingStartTimeRef.current
      ? (Date.now() - recordingStartTimeRef.current) / 1000
      : 0

    try {
      // Encode to WAV
      const wavEncoder = wavEncoderRef.current
      if (!wavEncoder) {
        console.log('[OverlayWindow] No WAV encoder, skipping transcription')
        return
      }

      const blob = wavEncoder.encode()
      const blobSize = blob.size

      // Clear encoder for next recording
      wavEncoder.clear()
      wavEncoderRef.current = null

      console.log(
        '[OverlayWindow] Recording WAV blob size:',
        blobSize,
        'bytes, duration:',
        duration,
        's'
      )

      // Check if the blob has meaningful content (minimum 100 bytes for valid audio)
      if (blobSize < 100) {
        console.log('[OverlayWindow] Blob too small, skipping transcription')
        return
      }

      const buf = await blob.arrayBuffer()
      const savedSettings = localStorage.getItem('dawn-settings')
      const currentSettings = savedSettings ? JSON.parse(savedSettings) : {}
      const currentPhraseReplacements = currentSettings.phraseReplacements || []
      const dictionaryWords = currentSettings.dictionaryWords || []

      // Get active smart transcription mode prompt
      const smartTranscriptionModes = currentSettings.smartTranscriptionModes || []
      const activeModeId = currentSettings.activeSmartTranscriptionModeId || 'default'
      const activeMode = smartTranscriptionModes.find((m: { id: string }) => m.id === activeModeId)
      const smartTranscriptionModePrompt = activeMode?.prompt || ''

      const res = await window.bridge.transcribe(blob.type, buf, duration, {
        dictionaryWords,
        smartTranscriptionModePrompt
      })
      const originalText = res?.text || ''

      // Apply phrase replacements to the transcribed text
      const processedText = applyPhraseReplacements(originalText, currentPhraseReplacements)

      console.log('Phrase replacement in paste:', {
        originalText,
        processedText,
        phraseReplacements: currentPhraseReplacements
      })

      // Check for panel transcription destination (hold-to-transcribe feature)
      const panelDestination = await window.bridge.getPanelTranscriptionDestination()

      if (panelDestination) {
        // Route transcription to panel instead of pasting
        const { panel, wasVisible } = panelDestination

        // Check settings to determine if we should create new chat/note
        // Setting: pasteTranscriptionInNewChat / pasteTranscriptionInNewNote
        // If setting ON and panel was hidden: send to new
        // Otherwise: send to existing input
        const settingKey =
          panel === 'chat' ? 'pasteTranscriptionInNewChat' : 'pasteTranscriptionInNewNote'
        const createNew = !wasVisible && (currentSettings[settingKey] ?? true)

        console.log(
          `[OverlayWindow] Routing to ${panel} panel, wasVisible: ${wasVisible}, createNew: ${createNew}`
        )

        if (panel === 'chat') {
          if (createNew) {
            await window.bridge.sendTextToNewChat(processedText)
          } else {
            await window.bridge.sendTextToChatInput(processedText)
          }
        } else {
          // notebook
          if (createNew) {
            await window.bridge.sendTextToNewNote(processedText)
          } else {
            await window.bridge.sendTextToNoteInput(processedText)
          }
        }

        // Clear the destination after sending
        await window.bridge.clearPanelTranscriptionDestination()
      } else if (currentRecordingSource === 'mic') {
        // If recording was triggered by mic button, open TranscriptionPanel
        console.log('[OverlayWindow] Opening TranscriptionPanel with text')
        await window.bridge.sendTranscriptionToPanel(processedText)
      } else {
        // Otherwise, paste the text directly
        await window.bridge.pasteText(processedText)
      }
    } catch (err) {
      console.error('[renderer] transcription/paste failed', err)
    } finally {
      setIsProcessing(false) // Hide processing animation
      // Close AudioContext to release audio resources
      if (audioContextRef.current) {
        await audioContextRef.current.close()
        audioContextRef.current = null
        console.log('[OverlayWindow] Closed AudioContext')
      }
    }
  }

  async function cancelRecording() {
    if (!recordingRef.current && !isSettingUpRef.current) return

    console.log('[OverlayWindow] Canceling recording (quick release)')

    // Set recordingRef to false FIRST so startRecording can detect cancellation
    recordingRef.current = false
    setRecording(false)
    setRecordingSource(null)
    setIsPaused(false)

    // Wait briefly for any ongoing setup to detect the cancellation
    // This gives getUserMedia time to complete and clean up
    if (isSettingUpRef.current) {
      console.log('[OverlayWindow] Setup in progress, waiting for cleanup...')
      let waitCount = 0
      while (isSettingUpRef.current && waitCount < 20) {
        await new Promise((resolve) => setTimeout(resolve, 10))
        waitCount++
      }
      console.log('[OverlayWindow] Setup cleanup wait complete')
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    // Disconnect processor node
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect()
      processorNodeRef.current = null
    }

    // Clear WAV encoder
    if (wavEncoderRef.current) {
      wavEncoderRef.current.clear()
      wavEncoderRef.current = null
    }

    // Stop microphone immediately and aggressively for quick releases
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log('[OverlayWindow] Force stopped track:', track.kind, track.label)
      })
      streamRef.current = null
    }

    // Close AudioContext immediately to release audio resources
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close()
        audioContextRef.current = null
        console.log('[OverlayWindow] Force closed AudioContext')
      } catch (error) {
        console.error('[OverlayWindow] Error closing AudioContext:', error)
      }
    }

    // Clear the recorded chunks without sending to API
    chunksRef.current = []

    // Reset all references to ensure clean state
    recRef.current = null
    isSettingUpRef.current = false

    // Safety clear any panel transcription destination (in case of quick release)
    await window.bridge.clearPanelTranscriptionDestination()

    console.log('[OverlayWindow] Recording canceled and cleaned up (microphone released)')
  }

  useEffect(() => {
    console.log('Setting up event listeners')
    const offStart = window.bridge?.onRecordStart?.(startRecording)
    const offStop = window.bridge?.onRecordStop?.(stopRecording)
    const offCancel = window.bridge?.onRecordCancel?.(cancelRecording)
    return () => {
      console.log('Cleaning up event listeners')
      offStart?.()
      offStop?.()
      offCancel?.()
    }
  }, []) // Only run once on mount

  // Listen for panel closed events (when panel window is closed externally)
  useEffect(() => {
    const offPanelClosed = window.bridge?.onPanelClosed?.((panelType) => {
      // Remove from openPanels set
      setOpenPanels((prev) => {
        const next = new Set(prev)
        next.delete(panelType as 'notebook' | 'chat' | 'browser')
        return next
      })
      if (activePanel === panelType) {
        setActivePanel(null)
      }
    })
    return () => {
      offPanelClosed?.()
    }
  }, [activePanel])

  // Listen for panel visibility changes (from hotkey toggle or other sources)
  // This keeps the overlay UI in sync when panels are hidden/shown via hotkey
  useEffect(() => {
    const offVisibilityChanged = window.bridge?.onPanelVisibilityChanged?.(
      (panelType, isVisible) => {
        console.log(`[OverlayWindow] Visibility changed: ${panelType} -> ${isVisible}`)
        if (isVisible) {
          // Panel is now visible - track it but don't auto-expand
          // User can hover to see open panels
          setOpenPanels((prev) => new Set(prev).add(panelType))
          setActivePanel(panelType)
        } else {
          // Panel is now hidden
          setOpenPanels((prev) => {
            const next = new Set(prev)
            next.delete(panelType)
            return next
          })
          if (activePanel === panelType) {
            setActivePanel(null)
          }
        }
      }
    )
    return () => {
      offVisibilityChanged?.()
    }
  }, [activePanel, settings.expandBottomOverlay])

  // Determine dimensions based on state
  // Overlay only expands on hover - panels being open just highlights the buttons when hovered
  const getOverlayDimensions = (): { width: number; height: number } => {
    if (recording) {
      // If recording was triggered by mic button, show full controls
      if (recordingSource === 'mic') {
        return { width: MIC_RECORDING_WIDTH, height: MIC_RECORDING_HEIGHT }
      }
      // If recording via hotkey while panel is open, show waveform only (same as normal recording)
      return { width: RECORDING_WIDTH, height: RECORDING_HEIGHT }
    }
    if (isProcessing) {
      // Processing state: show compact bar with wave animation
      return { width: RECORDING_WIDTH, height: RECORDING_HEIGHT }
    }
    if (isHovered) {
      return { width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT }
    }
    return { width: IDLE_WIDTH, height: IDLE_HEIGHT }
  }

  const { width, height } = getOverlayDimensions()
  const isExpanded = isHovered
  const isMicRecording = recording && recordingSource === 'mic'

  return (
    <div
      style={
        {
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          background: 'transparent',
          padding: 16,
          // Make the entire window draggable
          WebkitAppRegion: 'drag'
        } as React.CSSProperties
      }
    >
      {/* Hover detection wrapper - transparent, larger hit area */}
      <div
        onMouseEnter={() => {
          if (!recording) {
            // Clear any pending collapse immediately on entry
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
              hoverTimeoutRef.current = null
            }
            // Expand immediately and show buttons (animation handles smooth appearance)
            setIsHovered(true)
            setShowButtons(true)
          }
        }}
        onMouseMove={() => {
          // Keep clearing any pending collapse while cursor is inside
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = null
          }
        }}
        onMouseLeave={() => {
          // Always collapse on mouse leave
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = null
          }
          setIsHovered(false)
          setShowButtons(false)
        }}
        style={
          {
            // Use fixed dimensions that cover the expanded size
            width: EXPANDED_WIDTH + 32,
            height: EXPANDED_HEIGHT + 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitAppRegion: 'no-drag'
          } as React.CSSProperties
        }
      >
        {/* Control bar */}
        <div
          style={
            {
              width,
              height,
              borderRadius: recording ? (isMicRecording ? 24 : 14) : isExpanded ? 24 : 10,
              background:
                recording || isExpanded ? 'rgba(19, 19, 19, 0.95)' : 'rgba(19, 19, 19, 0.8)',
              border:
                recording || isExpanded
                  ? '1px solid rgba(255, 255, 255, 0.15)'
                  : '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(20px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: recording ? (isMicRecording ? 10 : WAVEFORM_GAP) : isExpanded ? 6 : WAVEFORM_GAP,
              padding: recording ? '0 6px' : isExpanded ? '0 8px' : 0,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: 'none',
              // Prevent inner bar from interfering with wrapper hover detection
              pointerEvents: 'none'
            } as React.CSSProperties
          }
        >
          {recording ? (
            isMicRecording ? (
              // Mic recording mode: Stop button + Waveform + Pause/Play button
              <>
                {/* Stop button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    stopRecording()
                  }}
                  style={
                    {
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: '#dc2626',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      padding: 0,
                      pointerEvents: 'auto',
                      WebkitAppRegion: 'no-drag',
                      animation: 'fadeScaleIn 0.15s ease-out'
                    } as React.CSSProperties
                  }
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#ef4444'
                    e.currentTarget.style.transform = 'scale(1.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#dc2626'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  <Square size={12} color="#fff" fill="#fff" />
                </button>

                {/* Waveform */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: WAVEFORM_GAP,
                    animation: 'fadeScaleIn 0.15s ease-out'
                  }}
                >
                  {audioLevels.map((level, i) => (
                    <div
                      key={i}
                      style={{
                        width: WAVEFORM_BAR_WIDTH,
                        height: Math.max(2, level * WAVEFORM_BAR_MAX_HEIGHT),
                        background: '#fff',
                        borderRadius: 1,
                        transition: 'height 0.05s ease'
                      }}
                    />
                  ))}
                </div>

                {/* Pause/Play button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePause()
                  }}
                  title={isPaused ? 'Resume recording' : 'Pause recording'}
                  style={
                    {
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      padding: 0,
                      pointerEvents: 'auto',
                      WebkitAppRegion: 'no-drag',
                      animation: 'fadeScaleIn 0.15s ease-out'
                    } as React.CSSProperties
                  }
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                    e.currentTarget.style.transform = 'scale(1.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  {isPaused ? (
                    <Play size={15} color="rgba(255,255,255,0.7)" strokeWidth={1.75} />
                  ) : (
                    <Pause size={15} color="rgba(255,255,255,0.7)" strokeWidth={1.75} />
                  )}
                </button>
              </>
            ) : (
              // Simple waveform for non-expanded recording
              audioLevels.map((level, i) => (
                <div
                  key={i}
                  style={{
                    width: WAVEFORM_BAR_WIDTH,
                    height: Math.max(2, level * WAVEFORM_BAR_MAX_HEIGHT),
                    background: '#fff',
                    borderRadius: 1,
                    transition: 'height 0.05s ease'
                  }}
                />
              ))
            )
          ) : isProcessing ? (
            // Processing state: waveform bars with bouncing wave animation
            Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: WAVEFORM_BAR_WIDTH,
                  height: 2,
                  background: '#fff',
                  borderRadius: 1,
                  animation: `waveBounce 1.6s ease-in-out infinite`,
                  animationDelay: `${i * 0.08}s`
                }}
              />
            ))
          ) : isExpanded && showButtons ? (
            // Expanded state with action buttons (shown after expansion animation)
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  togglePanel('notebook')
                }}
                style={
                  {
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: openPanels.has('notebook')
                      ? 'rgba(255, 255, 255, 0.25)'
                      : 'rgba(255, 255, 255, 0.08)',
                    border: openPanels.has('notebook')
                      ? '1px solid rgba(255, 255, 255, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition:
                      'background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    padding: 0,
                    pointerEvents: 'auto',
                    WebkitAppRegion: 'no-drag',
                    animation: 'buttonFadeIn 0.12s ease-out forwards',
                    animationDelay: '180ms',
                    opacity: 0
                  } as React.CSSProperties
                }
                onMouseEnter={(e) => {
                  if (!openPanels.has('notebook')) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                  }
                  e.currentTarget.style.transform = 'scale(1.08)'
                }}
                onMouseLeave={(e) => {
                  if (!openPanels.has('notebook')) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                  }
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <Notebook
                  size={15}
                  color={openPanels.has('notebook') ? '#fff' : 'rgba(255,255,255,0.7)'}
                  strokeWidth={1.75}
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  startRecording('mic')
                }}
                style={
                  {
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition:
                      'background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    padding: 0,
                    pointerEvents: 'auto',
                    WebkitAppRegion: 'no-drag',
                    animation: 'buttonFadeIn 0.12s ease-out forwards',
                    animationDelay: '200ms',
                    opacity: 0
                  } as React.CSSProperties
                }
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                  e.currentTarget.style.transform = 'scale(1.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <Mic size={15} color="rgba(255,255,255,0.7)" strokeWidth={1.75} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  togglePanel('chat')
                }}
                style={
                  {
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: openPanels.has('chat')
                      ? 'rgba(255, 255, 255, 0.25)'
                      : 'rgba(255, 255, 255, 0.08)',
                    border: openPanels.has('chat')
                      ? '1px solid rgba(255, 255, 255, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition:
                      'background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    padding: 0,
                    pointerEvents: 'auto',
                    WebkitAppRegion: 'no-drag',
                    animation: 'buttonFadeIn 0.12s ease-out forwards',
                    animationDelay: '220ms',
                    opacity: 0
                  } as React.CSSProperties
                }
                onMouseEnter={(e) => {
                  if (!openPanels.has('chat')) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                  }
                  e.currentTarget.style.transform = 'scale(1.08)'
                }}
                onMouseLeave={(e) => {
                  if (!openPanels.has('chat')) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                  }
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <MessageCircle
                  size={15}
                  color={openPanels.has('chat') ? '#fff' : 'rgba(255,255,255,0.7)'}
                  strokeWidth={1.75}
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  togglePanel('browser')
                }}
                style={
                  {
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: openPanels.has('browser')
                      ? 'rgba(255, 255, 255, 0.25)'
                      : 'rgba(255, 255, 255, 0.08)',
                    border: openPanels.has('browser')
                      ? '1px solid rgba(255, 255, 255, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition:
                      'background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    padding: 0,
                    pointerEvents: 'auto',
                    WebkitAppRegion: 'no-drag',
                    animation: 'buttonFadeIn 0.12s ease-out forwards',
                    animationDelay: '240ms',
                    opacity: 0
                  } as React.CSSProperties
                }
                onMouseEnter={(e) => {
                  if (!openPanels.has('browser')) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                  }
                  e.currentTarget.style.transform = 'scale(1.08)'
                }}
                onMouseLeave={(e) => {
                  if (!openPanels.has('browser')) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                  }
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <Globe
                  size={15}
                  color={openPanels.has('browser') ? '#fff' : 'rgba(255,255,255,0.7)'}
                  strokeWidth={1.75}
                />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeScaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes buttonFadeIn {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes waveBounce {
          0%, 100% {
            height: 2px;
          }
          25% {
            height: 15px;
          }
          50% {
            height: 2px;
          }
          75% {
            height: 15px;
          }
        }
      `}</style>
    </div>
  )
}
