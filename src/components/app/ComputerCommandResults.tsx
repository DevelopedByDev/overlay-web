'use client'

import { useMemo } from 'react'
import { Download, CheckCircle, XCircle, Info } from 'lucide-react'
import { MarkdownMessage } from '@/components/app/MarkdownMessage'
import {
  type ComputerCommandResult,
  type ComputerCommandField,
} from '@/lib/computer-commands'

function FieldGrid({ fields }: { fields: ComputerCommandField[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={`${field.label}:${field.value}`} className="rounded-lg border border-[#ebebeb] bg-[#f8f8f8] px-3 py-2.5">
          <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#b0b0b0]">{field.label}</div>
          <div className="break-all text-[13px] font-medium text-[#111]">{field.value}</div>
        </div>
      ))}
    </div>
  )
}

function ResultCard({ title, children, accentColor }: {
  title: string
  children: React.ReactNode
  accentColor?: string
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm">
      <div className={`flex items-center gap-2 border-b border-[#efefef] px-4 py-2.5 ${accentColor ? '' : 'bg-[#f8f8f8]'}`}
        style={accentColor ? { background: accentColor } : undefined}>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-[#999]">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function StatusBanner({ status, message }: { status: 'success' | 'info' | 'error'; message: string }) {
  const config = {
    success: { bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]', text: 'text-[#166534]', Icon: CheckCircle },
    error:   { bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]', text: 'text-[#991b1b]', Icon: XCircle },
    info:    { bg: 'bg-[#eff6ff]', border: 'border-[#bfdbfe]', text: 'text-[#1e40af]', Icon: Info },
  }[status]
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${config.bg} ${config.border}`}>
      <config.Icon size={13} className={`mt-0.5 shrink-0 ${config.text}`} />
      <span className={`text-sm leading-relaxed ${config.text}`}>{message}</span>
    </div>
  )
}

function DownloadButton({ filename, mimeType, content }: {
  filename: string
  mimeType: string
  content: string
}) {
  const href = useMemo(() => {
    const blob = new Blob([content], { type: mimeType })
    return URL.createObjectURL(blob)
  }, [content, mimeType])

  return (
    <a
      href={href}
      download={filename}
      className="inline-flex items-center gap-2 rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-1.5 text-xs font-medium text-[#333] transition-colors hover:bg-[#efefef]"
    >
      <Download size={12} />
      Download {filename}
    </a>
  )
}

export function CommandBubble({ command }: { command: string }) {
  return (
    <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-[#0a0a0a] px-4 py-2.5 text-sm text-[#fafafa]">
      <span className="font-mono text-[#a3e635]">{command}</span>
    </div>
  )
}

export function CommandResultCard({ result }: { result: ComputerCommandResult }) {
  if (result.kind === 'catalog') {
    return (
      <ResultCard title={result.title}>
        <div className="space-y-4">
          {result.sections.map((section) => (
            <div key={section.label}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#bbb]">{section.label}</span>
                <div className="h-px flex-1 bg-[#f0f0f0]" />
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <div
                    key={item.command}
                    className={`flex items-center justify-between gap-4 rounded-lg px-3 py-2 ${
                      item.disabledReason ? 'opacity-40' : 'hover:bg-[#fafafa]'
                    }`}
                  >
                    <code className="shrink-0 rounded bg-[#f3f3f3] px-1.5 py-0.5 font-mono text-[12px] font-medium text-[#0a0a0a]">
                      {item.command}
                    </code>
                    <span className="min-w-0 truncate text-right text-xs text-[#888]">
                      {item.disabledReason ?? item.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ResultCard>
    )
  }

  if (result.kind === 'status') {
    return (
      <ResultCard title={result.title}>
        <div className="space-y-3">
          <FieldGrid fields={result.summary} />
          {result.details && result.details.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#ccc]">Details</span>
                <div className="h-px flex-1 bg-[#f0f0f0]" />
              </div>
              <FieldGrid fields={result.details} />
            </>
          )}
          {result.usage && result.usage.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#ccc]">Usage</span>
                <div className="h-px flex-1 bg-[#f0f0f0]" />
              </div>
              <FieldGrid fields={result.usage} />
            </>
          )}
          {result.providerUsage && result.providerUsage.length > 0 && <FieldGrid fields={result.providerUsage} />}
          {result.session && result.session.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#ccc]">Session</span>
                <div className="h-px flex-1 bg-[#f0f0f0]" />
              </div>
              <FieldGrid fields={result.session} />
            </>
          )}
        </div>
      </ResultCard>
    )
  }

  if (result.kind === 'identity') {
    return (
      <ResultCard title={result.title}>
        <FieldGrid fields={result.fields} />
      </ResultCard>
    )
  }

  if (result.kind === 'settings') {
    return (
      <ResultCard title={result.title}>
        <div className="space-y-3">
          <StatusBanner status={result.status === 'error' ? 'error' : result.status === 'info' ? 'info' : 'success'} message={result.message} />
          {result.fields.length > 0 && <FieldGrid fields={result.fields} />}
          {result.options && result.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.options.map((option) => (
                <div
                  key={`${option.label}:${option.value}`}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    option.active
                      ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                      : 'border-[#e0e0e0] bg-white text-[#888]'
                  }`}
                >
                  {option.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </ResultCard>
    )
  }

  if (result.kind === 'model') {
    return (
      <ResultCard title={result.title}>
        <div className="space-y-3">
          <FieldGrid fields={result.fields} />
          <div className="space-y-1.5">
            {result.options.map((option) => (
              <div
                key={`${option.label}:${option.value}`}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  option.active
                    ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                    : 'border-[#ebebeb] bg-[#fafafa] text-[#333]'
                }`}
              >
                <span className="text-sm font-medium">{option.label}</span>
                <span className={`font-mono text-[11px] ${option.active ? 'text-white/60' : 'text-[#aaa]'}`}>
                  {option.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </ResultCard>
    )
  }

  if (result.kind === 'usage') {
    return (
      <ResultCard title={result.title}>
        <div className="space-y-3">
          <FieldGrid fields={result.fields} />
          {result.tables?.map((table, index) => (
            <div key={index} className="overflow-x-auto rounded-lg border border-[#ebebeb]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f8f8f8]">
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column} className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#aaa]">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-[#f2f2f2] hover:bg-[#fafafa]">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 text-[13px] text-[#222]">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </ResultCard>
    )
  }

  if (result.kind === 'context') {
    return (
      <ResultCard title={result.title}>
        <div className="space-y-3">
          <FieldGrid fields={result.fields} />
          {result.blocks?.map((block) => (
            <div key={block.label} className="rounded-lg border border-[#ebebeb] bg-[#f8f8f8] p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#bbb]">{block.label}</div>
              <div className="text-sm leading-relaxed text-[#111]">
                <MarkdownMessage text={block.content} isStreaming={false} />
              </div>
            </div>
          ))}
        </div>
      </ResultCard>
    )
  }

  if (result.kind === 'btw') {
    return (
      <ResultCard title={result.title}>
        <div className="space-y-3">
          <div className="rounded-lg border border-[#ebebeb] bg-[#f8f8f8] px-3 py-2.5">
            <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#b0b0b0]">Question</div>
            <div className="text-sm text-[#111]">{result.question}</div>
          </div>
          <div className="rounded-lg border border-[#ebebeb] px-3 py-2.5">
            <div className="text-sm leading-relaxed text-[#111]">
              <MarkdownMessage text={result.answer} isStreaming={false} />
            </div>
          </div>
        </div>
      </ResultCard>
    )
  }

  if (result.kind === 'export') {
    return (
      <ResultCard title={result.title}>
        <div className="space-y-3">
          <FieldGrid fields={result.fields} />
          <DownloadButton filename={result.filename} mimeType={result.mimeType} content={result.content} />
        </div>
      </ResultCard>
    )
  }

  if (result.kind === 'admin-table') {
    return (
      <ResultCard title={result.title}>
        <div className="space-y-3">
          {result.fields && result.fields.length > 0 && <FieldGrid fields={result.fields} />}
          {result.tables.map((table, index) => (
            <div key={index} className="overflow-x-auto rounded-lg border border-[#ebebeb]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f8f8f8]">
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column} className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#aaa]">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-xs text-[#bbb]" colSpan={table.columns.length}>
                        No rows.
                      </td>
                    </tr>
                  ) : (
                    table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-[#f2f2f2] hover:bg-[#fafafa]">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 text-[13px] text-[#222]">{cell}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </ResultCard>
    )
  }

  if (result.kind === 'action') {
    return (
      <ResultCard title={result.title}>
        <div className="space-y-3">
          <StatusBanner status={result.status === 'error' ? 'error' : result.status === 'info' ? 'info' : 'success'} message={result.message} />
          {result.fields && result.fields.length > 0 && <FieldGrid fields={result.fields} />}
        </div>
      </ResultCard>
    )
  }

  if (result.kind === 'raw') {
    return (
      <ResultCard title={result.title}>
        <div className="text-sm leading-relaxed text-[#111]">
          <MarkdownMessage text={result.markdown} isStreaming={false} />
        </div>
      </ResultCard>
    )
  }

  return (
    <ResultCard title={result.title}>
      <div className="text-sm text-[#666]">{result.message}</div>
    </ResultCard>
  )
}
