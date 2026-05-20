'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

type ChatEmptyStateProps = {
  visible: boolean
  greetingLine: string
  starters: string[]
  belowComposer?: ReactNode
  onStarterSelect: (prompt: string) => void
}

export function ChatEmptyHero({
  visible,
  greetingLine,
}: {
  visible: boolean
  greetingLine: string
}) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="chat-empty-hero"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="text-center max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:items-center max-md:justify-center md:mb-8"
        >
          <p className="text-3xl text-[var(--foreground)]" style={{ fontFamily: 'var(--font-serif)' }}>
            {greetingLine}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ChatEmptyState({
  visible,
  starters,
  belowComposer,
  onStarterSelect,
}: ChatEmptyStateProps) {
  return (
    <>
      <AnimatePresence initial={false}>
        {visible && (
          <motion.div
            key="chat-suggestions"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="mx-auto mt-6 hidden w-full max-w-[36rem] min-w-0 px-0 md:mt-6 md:block"
          >
            <div className="grid grid-cols-1 gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
              {starters.map((prompt, idx) => (
                <button
                  key={`empty-starter-${idx}`}
                  type="button"
                  className="rounded-lg border border-[var(--border)] p-2.5 text-left leading-snug transition-colors hover:bg-[var(--surface-muted)]"
                  onClick={() => onStarterSelect(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {visible && belowComposer ? (
        <div className="mx-auto mt-8 w-full max-w-[36rem] min-w-0 px-0">
          {belowComposer}
        </div>
      ) : null}
    </>
  )
}
