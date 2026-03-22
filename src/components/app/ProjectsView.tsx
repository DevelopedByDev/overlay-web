'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { FolderOpen, Loader2 } from 'lucide-react'
import ChatInterface from './ChatInterface'
import NotebookEditor from './NotebookEditor'
import { FileViewerPanel, isEditableType } from './FileViewer'

// ─── File viewer fetched by ID ────────────────────────────────────────────────

function ProjectFileView({ fileId }: { fileId: string }) {
  const [file, setFile] = useState<{ name: string; content: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileContent, setFileContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const timeoutId = setTimeout(() => {
      setLoading(true)
      fetch(`/api/app/files?fileId=${fileId}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          setFile(data)
          setFileContent(data.content ?? '')
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
          }
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [fileId])

  function handleContentChange(val: string) {
    setFileContent(val)
    if (!file) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true)
      await fetch('/api/app/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, content: val }),
      })
      setIsSaving(false)
    }, 800)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#888]">
        <Loader2 size={16} className="animate-spin" />
      </div>
    )
  }
  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#aaa] text-sm">
        File not found
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FileViewerPanel
        name={file.name}
        content={fileContent}
        isSaving={isSaving}
        isEditable={isEditableType(file.name)}
        onContentChange={handleContentChange}
      />
    </div>
  )
}

// ─── ProjectsView ─────────────────────────────────────────────────────────────

export default function ProjectsView({ userId }: { userId: string }) {
  const searchParams = useSearchParams()
  const view = searchParams.get('view')
  const id = searchParams.get('id')
  const projectName = searchParams.get('projectName') ?? undefined

  if (view === 'chat' && id) {
    return <ChatInterface userId={userId} hideSidebar projectName={projectName} />
  }

  if (view === 'note' && id) {
    return <NotebookEditor userId={userId} hideSidebar projectName={projectName} />
  }

  if (view === 'file' && id) {
    return <ProjectFileView fileId={id} />
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-[#888]">
      <FolderOpen size={40} strokeWidth={1} className="opacity-30" />
      <p className="text-sm">Select a project to get started</p>
    </div>
  )
}
