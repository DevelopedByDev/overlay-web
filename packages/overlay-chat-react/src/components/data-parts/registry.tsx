import { createContext, useContext, type ChangeEvent, type ReactNode } from 'react'
import type { ComponentRegistry } from '@json-render/react'

export type JsonRenderActionName = 'send' | 'cancel' | string

export interface JsonRenderFormContextValue {
  values: Record<string, string>
  setValue: (name: string, value: string) => void
}

export interface JsonRenderActionContextValue {
  dispatch: (action: JsonRenderActionName) => void
  isActionDisabled?: (action: JsonRenderActionName) => boolean
  getActionLabel?: (action: JsonRenderActionName, fallback: string) => string
}

const noopForm: JsonRenderFormContextValue = {
  values: {},
  setValue: () => undefined,
}

const noopAction: JsonRenderActionContextValue = {
  dispatch: () => undefined,
  isActionDisabled: () => false,
  getActionLabel: (_action, fallback) => fallback,
}

export const JsonRenderFormContext = createContext<JsonRenderFormContextValue>(noopForm)
export const JsonRenderActionContext = createContext<JsonRenderActionContextValue>(noopAction)

interface CardProps {
  title?: string
  description?: string
}

function Card({ element, children }: { element: { props: CardProps }; children?: ReactNode }) {
  const { title, description } = element.props
  return (
    <div className="message-appear w-full max-w-[min(100%,36rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-sm text-[var(--foreground)]">
      {title ? (
        <div className="mb-2 text-[13px] font-semibold leading-snug text-[var(--foreground)]">{title}</div>
      ) : null}
      {description ? (
        <div className="mb-2 text-xs leading-snug text-[var(--muted)]">{description}</div>
      ) : null}
      <div className="space-y-2">{children}</div>
    </div>
  )
}

interface FieldProps {
  label?: string
  hint?: string
}

function Field({ element, children }: { element: { props: FieldProps }; children?: ReactNode }) {
  const { label, hint } = element.props
  return (
    <div className="space-y-1">
      {label ? (
        <div className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</div>
      ) : null}
      {children}
      {hint ? <div className="px-0.5 text-[11px] text-[var(--muted-light)]">{hint}</div> : null}
    </div>
  )
}

interface InputElementProps {
  name: string
  placeholder?: string
  type?: string
}

function InputField({ element }: { element: { props: InputElementProps } }) {
  const { name, placeholder, type = 'text' } = element.props
  const form = useContext(JsonRenderFormContext)
  return (
    <input
      type={type}
      name={name}
      value={form.values[name] ?? ''}
      placeholder={placeholder}
      onChange={(event: ChangeEvent<HTMLInputElement>) => form.setValue(name, event.target.value)}
      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--input-background,var(--surface))] px-3 text-sm text-[var(--input-text,var(--foreground))] outline-none placeholder:text-[var(--input-placeholder,var(--muted-light))] focus:ring-1 focus:ring-[var(--foreground)]"
    />
  )
}

interface TextareaElementProps {
  name: string
  placeholder?: string
  rows?: number
}

function TextareaField({ element }: { element: { props: TextareaElementProps } }) {
  const { name, placeholder, rows = 5 } = element.props
  const form = useContext(JsonRenderFormContext)
  return (
    <textarea
      name={name}
      rows={rows}
      value={form.values[name] ?? ''}
      placeholder={placeholder}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => form.setValue(name, event.target.value)}
      className="min-h-[6rem] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input-background,var(--surface))] px-3 py-2 text-sm leading-6 text-[var(--input-text,var(--foreground))] outline-none placeholder:text-[var(--input-placeholder,var(--muted-light))] focus:ring-1 focus:ring-[var(--foreground)]"
    />
  )
}

interface ButtonElementProps {
  label: string
  action: JsonRenderActionName
  variant?: 'primary' | 'secondary' | 'danger'
}

function ActionButton({ element }: { element: { props: ButtonElementProps } }) {
  const { label, action, variant = 'secondary' } = element.props
  const { dispatch, isActionDisabled, getActionLabel } = useContext(JsonRenderActionContext)
  const base =
    'inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
  const variantClass =
    variant === 'primary'
      ? 'bg-[var(--foreground)] text-[var(--background)] hover:opacity-90'
      : variant === 'danger'
        ? 'bg-red-500 text-white hover:opacity-90'
        : 'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-subtle)]'
  return (
    <button
      type="button"
      onClick={() => dispatch(action)}
      disabled={isActionDisabled?.(action) ?? false}
      className={`${base} ${variantClass}`}
    >
      {getActionLabel?.(action, label) ?? label}
    </button>
  )
}

function ButtonRow({ children }: { children?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 pt-1">{children}</div>
}

function Text({ element }: { element: { props: { text?: string; tone?: 'default' | 'muted' } } }) {
  const { text = '', tone = 'default' } = element.props
  const className = tone === 'muted' ? 'text-xs text-[var(--muted)]' : 'text-sm text-[var(--foreground)]'
  return <p className={className}>{text}</p>
}

export const jsonRenderRegistry: ComponentRegistry = {
  Card,
  Field,
  Input: InputField,
  Textarea: TextareaField,
  Button: ActionButton,
  ButtonRow,
  Text,
}

export const jsonRenderRegistryKnownTypes = Object.keys(jsonRenderRegistry)
