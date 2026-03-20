'use client'

import { MessageSquare, ImageIcon, Video } from 'lucide-react'
import type { GenerationMode } from '@/lib/models'

interface GenerationModeToggleProps {
  mode: GenerationMode
  onChange: (mode: GenerationMode) => void
  disabled?: boolean
  className?: string
}

const MODES: { value: GenerationMode; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { value: 'text', label: 'Text', Icon: MessageSquare },
  { value: 'image', label: 'Image', Icon: ImageIcon },
  { value: 'video', label: 'Video', Icon: Video },
]

export function GenerationModeToggle({ mode, onChange, disabled, className = '' }: GenerationModeToggleProps) {
  return (
    <div className={`flex items-center bg-[#f0f0f0] rounded-lg p-0.5 shrink-0 ${className}`}>
      {MODES.map(({ value, label, Icon }) => {
        const active = mode === value
        return (
          <button
            key={value}
            onClick={() => !disabled && onChange(value)}
            disabled={disabled}
            title={label}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            } ${
              active
                ? 'bg-white text-[#0a0a0a] shadow-sm font-medium'
                : 'text-[#888] hover:text-[#525252]'
            }`}
          >
            <Icon size={11} />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
