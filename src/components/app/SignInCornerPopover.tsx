'use client'

import { X } from 'lucide-react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { SignInForm } from '@/components/auth/SignInForm'

interface Props {
  onDismiss: () => void
}

export function SignInCornerPopover({ onDismiss }: Props) {
  const pathname = usePathname() ?? '/app/chat'

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[320px] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl"
      role="dialog"
      aria-label="Sign in to overlay"
    >
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <Image src="/assets/overlay-logo.png" alt="" width={20} height={20} className="shrink-0" />
          <p className="text-sm font-medium text-[var(--foreground)]">Sign in or create an account</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="mt-0.5 shrink-0 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        >
          <X size={15} />
        </button>
      </div>
      <p className="px-5 pb-3 text-xs text-[var(--muted)]">
        Save your chats, notes, and knowledge across sessions.
      </p>
      <div className="px-5 pb-5">
        <SignInForm redirectTo={pathname} />
      </div>
    </div>
  )
}
