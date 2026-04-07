'use client'

import { Moon, PanelsLeftRight, Sun } from 'lucide-react'
import { useAppSettings } from '@/components/app/AppSettingsProvider'

function SettingsToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
        checked
          ? 'border-[var(--foreground)] bg-[var(--foreground)]'
          : 'border-[var(--border)] bg-[var(--surface-subtle)]'
      } ${disabled ? 'cursor-wait opacity-70' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-[var(--surface-elevated)] transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function SettingRow({
  icon,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--foreground)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-[var(--foreground)]">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
        </div>
      </div>
      <SettingsToggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}

export default function SettingsPage() {
  const {
    settings,
    isLoading,
    isSaving,
    updateSettings,
  } = useAppSettings()

  const busy = isLoading || isSaving

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="flex h-16 shrink-0 items-center border-b border-[var(--border)] px-6">
        <h1 className="text-sm font-medium text-[var(--foreground)]">Settings</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <SettingRow
            icon={settings.theme === 'dark' ? <Moon size={18} strokeWidth={1.8} /> : <Sun size={18} strokeWidth={1.8} />}
            title="Dark mode"
            description="Toggle the app between light and dark appearance."
            checked={settings.theme === 'dark'}
            disabled={busy}
            onChange={() => void updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          />
          <SettingRow
            icon={<PanelsLeftRight size={18} strokeWidth={1.8} />}
            title="Secondary sidebar"
            description="Keep route-specific secondary sidebars enabled. When off, the app will use the single-sidebar layout once that rollout is completed."
            checked={settings.useSecondarySidebar}
            disabled={busy}
            onChange={() => void updateSettings({ useSecondarySidebar: !settings.useSecondarySidebar })}
          />
        </div>
      </div>
    </div>
  )
}
