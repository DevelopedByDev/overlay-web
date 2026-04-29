'use client'

import { ImagePlus, MessageCirclePlus, SmilePlus, X } from 'lucide-react'

const emojiChoices = ['😀', '✨', '🧠', '📌', '🚀', '📚', '💡', '✅', '🔥', '🎯']

export default function PageHeader({
  icon,
  coverImage,
  coverPosition = 0.5,
  onIconChange,
  onCoverChange,
  onCoverRemove,
}: {
  icon?: string
  coverImage?: string
  coverPosition?: number
  onIconChange: (icon: string | undefined) => void
  onCoverChange: (file: File) => void
  onCoverRemove: () => void
}) {
  return (
    <div className="border-b border-[var(--border)] bg-[var(--background)]">
      {coverImage ? (
        <div className="group relative h-[200px] overflow-hidden bg-[var(--surface-subtle)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImage}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: `50% ${Math.round(coverPosition * 100)}%` }}
          />
          <div className="absolute right-4 top-4 hidden items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-sm group-hover:flex">
            <label className="cursor-pointer rounded px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
              Change
              <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onCoverChange(file)
              }} />
            </label>
            <button type="button" onClick={onCoverRemove} className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]" aria-label="Remove cover">
              <X size={13} />
            </button>
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-3">
        <div className="relative group/icon">
          <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
            {icon ? <span className="text-base">{icon}</span> : <SmilePlus size={14} />}
            {icon ? 'Change icon' : 'Add icon'}
          </button>
          <div className="absolute left-0 top-9 z-40 hidden w-56 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-lg group-hover/icon:block">
            <div className="grid grid-cols-5 gap-1">
              {emojiChoices.map((emoji) => (
                <button key={emoji} type="button" onClick={() => onIconChange(emoji)} className="h-8 rounded-md text-lg hover:bg-[var(--surface-subtle)]">
                  {emoji}
                </button>
              ))}
            </div>
            {icon ? (
              <button type="button" onClick={() => onIconChange(undefined)} className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)]">
                Remove icon
              </button>
            ) : null}
          </div>
        </div>
        {!coverImage ? (
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]">
            <ImagePlus size={14} />
            Add cover
            <input type="file" accept="image/*" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onCoverChange(file)
            }} />
          </label>
        ) : null}
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]" title="Page comments are not wired yet">
          <MessageCirclePlus size={14} />
          Add comment
        </button>
      </div>
    </div>
  )
}
