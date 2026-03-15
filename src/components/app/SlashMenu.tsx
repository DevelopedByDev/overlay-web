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
        top: Math.max(8, Math.min(slashMenuPosition.top, window.innerHeight - 340)),
        left: Math.max(8, Math.min(slashMenuPosition.left, window.innerWidth - 296)),
        width: 280,
        maxHeight: 320,
        background: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid #e5e5e5',
        borderRadius: 12,
        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.12)',
        overflow: 'hidden',
        zIndex: 100000,
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #ececec',
          fontSize: 11,
          color: '#71717a',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {slashMenuFilter ? `Searching "${slashMenuFilter}"` : 'Commands'}
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: 4 }}>
        {filteredSlashItems.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: '#71717a',
              fontSize: 13,
            }}
          >
            No matching commands
          </div>
        ) : (
          <>
            {filteredSlashItems.filter((item) => item.category === 'nodes').length > 0 && (
              <>
                <div
                  style={{
                    padding: '6px 8px',
                    fontSize: 10,
                    color: '#71717a',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  Blocks
                </div>
                {filteredSlashItems
                  .filter((item) => item.category === 'nodes')
                  .map((item) => {
                    const globalIndex = filteredSlashItems.indexOf(item)
                    return (
                      <SlashMenuButton
                        key={item.title}
                        item={item}
                        isSelected={selectedSlashIndex === globalIndex}
                        onSelect={() => setSelectedSlashIndex(globalIndex)}
                        onExecute={() => executeSlashCommand(item)}
                      />
                    )
                  })}
              </>
            )}

            {filteredSlashItems.filter((item) => item.category === 'marks').length > 0 && (
              <>
                <div
                  style={{
                    padding: '6px 8px',
                    fontSize: 10,
                    color: '#71717a',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginTop: 4,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  Formatting
                </div>
                {filteredSlashItems
                  .filter((item) => item.category === 'marks')
                  .map((item) => {
                    const globalIndex = filteredSlashItems.indexOf(item)
                    return (
                      <SlashMenuButton
                        key={item.title}
                        item={item}
                        isSelected={selectedSlashIndex === globalIndex}
                        onSelect={() => setSelectedSlashIndex(globalIndex)}
                        onExecute={() => executeSlashCommand(item)}
                      />
                    )
                  })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )

  return createPortal(menu, document.body)
}

interface SlashMenuButtonProps {
  item: SlashMenuItem
  isSelected: boolean
  onSelect: () => void
  onExecute: () => void
}

function SlashMenuButton({
  item,
  isSelected,
  onSelect,
  onExecute,
}: SlashMenuButtonProps): React.ReactElement {
  return (
    <button
      onClick={onExecute}
      style={{
        width: '100%',
        padding: '8px 10px',
        background: isSelected ? '#f5f5f5' : 'transparent',
        border: 'none',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = '#f5f5f5'
        onSelect()
      }}
      onMouseLeave={(event) => {
        if (!isSelected) {
          event.currentTarget.style.background = 'transparent'
        }
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0a0a0a',
          flexShrink: 0,
        }}
      >
        {item.icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#0a0a0a',
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#71717a',
            marginTop: 1,
            lineHeight: 1.35,
          }}
        >
          {item.description}
        </div>
      </div>
    </button>
  )
}
