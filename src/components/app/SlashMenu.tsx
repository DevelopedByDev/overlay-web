import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface SlashMenuItem {
  title: string
  description: string
  icon: React.ReactNode
  command: () => void
  category: 'nodes' | 'marks'
}

interface SlashMenuProps {
  showSlashMenu: boolean
  slashMenuPosition: { top: number; left: number }
  slashMenuFilter: string
  selectedSlashIndex: number
  setSelectedSlashIndex: (index: number) => void
  filteredSlashItems: SlashMenuItem[]
  executeSlashCommand: (item: SlashMenuItem) => void
  onClose: () => void
}

// Render each item as a preview of what it produces — no icons, no descriptions
function getStyledLabel(title: string): React.ReactNode {
  switch (title) {
    case 'Heading 1':
      return (
        <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2, color: '#0a0a0a' }}>
          Heading 1
        </span>
      )
    case 'Heading 2':
      return (
        <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, color: '#0a0a0a' }}>
          Heading 2
        </span>
      )
    case 'Bullet List':
      return (
        <span style={{ fontSize: 13, color: '#0a0a0a' }}>
          &bull;&ensp;Bullet list
        </span>
      )
    case 'Numbered List':
      return (
        <span style={{ fontSize: 13, color: '#0a0a0a' }}>
          1.&ensp;Numbered list
        </span>
      )
    case 'Blockquote':
      return (
        <span
          style={{
            fontSize: 13,
            borderLeft: '2.5px solid #d4d4d8',
            paddingLeft: 7,
            color: '#71717a',
            fontStyle: 'italic',
          }}
        >
          Blockquote
        </span>
      )
    case 'Code Block':
      return (
        <span
          style={{
            fontSize: 12,
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
            background: '#f4f4f5',
            padding: '1px 6px',
            borderRadius: 4,
            color: '#0a0a0a',
          }}
        >
          Code block
        </span>
      )
    case 'Divider':
      return (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            fontSize: 12,
            color: '#a1a1aa',
          }}
        >
          <span style={{ flex: 1, borderTop: '1px solid #d4d4d8', display: 'block' }} />
          Divider
          <span style={{ flex: 1, borderTop: '1px solid #d4d4d8', display: 'block' }} />
        </span>
      )
    case 'Bold':
      return (
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0a' }}>Bold</span>
      )
    case 'Italic':
      return (
        <span style={{ fontSize: 13, fontStyle: 'italic', color: '#0a0a0a' }}>Italic</span>
      )
    case 'Strikethrough':
      return (
        <span style={{ fontSize: 13, textDecoration: 'line-through', color: '#0a0a0a' }}>
          Strikethrough
        </span>
      )
    default:
      return <span style={{ fontSize: 13, color: '#0a0a0a' }}>{title}</span>
  }
}

export default function SlashMenu({
  showSlashMenu,
  slashMenuPosition,
  slashMenuFilter,
  selectedSlashIndex,
  setSelectedSlashIndex,
  filteredSlashItems,
  executeSlashCommand,
  onClose,
}: SlashMenuProps): React.ReactElement | null {
  const slashMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showSlashMenu) return
    const handleClickOutside = (event: MouseEvent): void => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSlashMenu, onClose])

  if (!showSlashMenu) return null

  const menu = (
    <div
      ref={slashMenuRef}
      style={{
        position: 'fixed',
        top: Math.max(8, Math.min(slashMenuPosition.top, window.innerHeight - 280)),
        left: Math.max(8, Math.min(slashMenuPosition.left, window.innerWidth - 200)),
        width: 188,
        maxHeight: 280,
        background: 'rgba(255,255,255,0.97)',
        border: '1px solid #e5e5e5',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        zIndex: 100000,
      }}
    >
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 4px' }}>
        {filteredSlashItems.length === 0 ? (
          <div
            style={{
              padding: '12px 10px',
              textAlign: 'center',
              color: '#71717a',
              fontSize: 12,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            No results
          </div>
        ) : (
          filteredSlashItems.map((item, index) => (
            <button
              key={item.title}
              onClick={() => executeSlashCommand(item)}
              onMouseEnter={() => setSelectedSlashIndex(index)}
              style={{
                width: '100%',
                padding: '7px 10px',
                background: selectedSlashIndex === index ? '#f5f5f5' : 'transparent',
                border: 'none',
                borderRadius: 7,
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.08s ease',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {getStyledLabel(item.title)}
            </button>
          ))
        )}
      </div>
    </div>
  )

  return createPortal(menu, document.body)
}
