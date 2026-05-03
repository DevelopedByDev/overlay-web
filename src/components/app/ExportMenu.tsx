'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Copy, FileDown, FileText, FileType2, FileJson, Check } from 'lucide-react'
import { useExport, type ExportFormat } from './hooks/useExport'

interface ExportMenuProps {
  type: 'chat' | 'note'
  title: string
  content: string | Array<{ role: string; content: string; parts?: Array<{ type: string; text?: string }> }>
  metadata?: {
    createdAt?: number
    updatedAt?: number
    modelIds?: string[]
  }
}

export function ExportMenu({ type, title, content, metadata }: ExportMenuProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showExportSubmenu, setShowExportSubmenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { copyToClipboard, exportAs, isExporting } = useExport({
    type,
    title,
    content,
    metadata,
  })

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
        setShowExportSubmenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleCopy = async () => {
    await copyToClipboard('markdown')
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setShowMenu(false)
    }, 900)
  }

  const handleExport = async (format: ExportFormat) => {
    await exportAs(format)
    setShowMenu(false)
    setShowExportSubmenu(false)
  }

  const exportOptions: { format: ExportFormat; label: string; icon: typeof FileText }[] = [
    { format: 'markdown', label: 'Markdown', icon: FileText },
    { format: 'pdf', label: 'PDF', icon: FileType2 },
    { format: 'docx', label: 'Word', icon: FileType2 },
    { format: 'json', label: 'JSON', icon: FileJson },
  ]

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className="rounded-md p-1.5 text-[var(--muted)] transition-all duration-200 hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Export options"
      >
        <MoreVertical size={16} strokeWidth={1.75} />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy as Markdown</span>
              </>
            )}
          </button>

          <div className="my-1 border-t border-[var(--border)]" />

          <button
            type="button"
            onClick={() => setShowExportSubmenu(!showExportSubmenu)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            <FileDown size={14} />
            <span>Export as...</span>
          </button>

          {showExportSubmenu && (
            <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] py-1">
              {exportOptions.map(({ format, label, icon: Icon }) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => handleExport(format)}
                  disabled={isExporting}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--surface-muted)] transition-colors disabled:opacity-50"
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
