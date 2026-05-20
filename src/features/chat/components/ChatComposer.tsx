'use client'

/* eslint-disable react-hooks/refs */

import { AtSign, Check, ChevronDown, FileText, Image as ImageIcon, MessageSquare, Plus, Reply, Send, Video, X, Zap } from 'lucide-react'
import type { ClipboardEventHandler, Dispatch, RefObject, SetStateAction } from 'react'
import type { GenerationMode } from '@/shared/ai/gateway/model-types'
import { DelayedTooltip } from './DelayedTooltip'
import { MentionInput, type MentionInputHandle } from './chat-interface/MentionInput'
import type { MentionItem } from './chat-interface/mention-types'
import type { AttachedImage, Entitlements, PendingChatDocument } from './chat-interface/types'
import { ChatEmptyHero, ChatEmptyState } from './ChatEmptyState'
import { AttachmentPreviewTray, ComposerAlerts } from './ChatComposerAttachments'

export type ReplyContext = { snippet: string; bodyForModel: string; replyToTurnId?: string } | null

export type ChatComposerProps = {
  mode: 'chat' | 'automate'
  showCenteredEmptyChat: boolean
  greetingLine: string
  emptyChatStarters: string[]
  belowEmptyComposer?: React.ReactNode
  attachedImages: AttachedImage[]
  setAttachedImages: Dispatch<SetStateAction<AttachedImage[]>>
  pendingChatDocuments: PendingChatDocument[]
  removePendingDocument: (clientId: string) => void
  attachmentError: string | null
  composerNotice: string | null
  isSendBlocked: boolean
  isBudgetExhaustedPaid: boolean
  entitlements: Entitlements | null
  topUpAmountDraftCents: number
  setTopUpAmountDraftCents: (value: number) => void
  autoTopUpEnabledDraft: boolean
  setAutoTopUpEnabledDraft: (value: boolean) => void
  billingActionLoading: 'checkout' | 'save' | null
  onStartTopUp: () => void | Promise<void>
  onSaveTopUpPreference: () => void | Promise<void>
  blockedComposerContent: React.ReactNode
  replyContext: ReplyContext
  setReplyContext: (context: ReplyContext) => void
  fileInputRef: RefObject<HTMLInputElement | null>
  docInputRef: RefObject<HTMLInputElement | null>
  textareaRef: RefObject<MentionInputHandle | null>
  input: string
  inputRevision: number
  onInputChange: (text: string) => void
  onMentionsChange: (mentions: MentionItem[]) => void
  onPaste: ClipboardEventHandler
  onAddImages: (files: FileList | File[]) => void
  onAddDocumentsFromPicker: (files: FileList | File[] | null) => void
  supportsVision: boolean
  showAttachMenu: boolean
  setShowAttachMenu: Dispatch<SetStateAction<boolean>>
  attachMenuRef: RefObject<HTMLDivElement | null>
  onModeChange: (mode: GenerationMode) => void
  generationChip: 'image' | 'video' | null
  setGenerationChip: (chip: 'image' | 'video' | null) => void
  showModeMenu: boolean
  setShowModeMenu: Dispatch<SetStateAction<boolean>>
  modeMenuRef: RefObject<HTMLDivElement | null>
  onNavigateMode: (mode: 'chat' | 'automate') => void
  isActiveLoading: boolean
  hasComposerText: boolean
  onStop: () => void | Promise<void>
  onSend: () => void | Promise<void>
  onStarterSelect: (prompt: string) => void
}

export function ChatComposer(props: ChatComposerProps) {
  const disabledSend =
    !props.hasComposerText &&
    props.attachedImages.length === 0 &&
    !props.pendingChatDocuments.some((doc) => doc.status === 'ready')

  return (
    <>
      <div
        className={`flex min-h-0 flex-col ${
          props.showCenteredEmptyChat ? 'min-h-0 flex-1 md:justify-center' : 'shrink-0'
        } ${!props.showCenteredEmptyChat ? 'px-3 pb-3 sm:px-4 sm:pb-4' : 'px-4 pb-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))]'}`}
      >
        <ChatEmptyHero visible={props.showCenteredEmptyChat} greetingLine={props.greetingLine} />
        <div
          className={`mx-auto w-full min-w-0 shrink-0 transition-[max-width] duration-[780ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            props.showCenteredEmptyChat ? 'max-w-[36rem]' : 'max-w-[56rem]'
          }`}
        >
          <AttachmentPreviewTray {...props} />
          <ComposerAlerts attachmentError={props.attachmentError} composerNotice={props.composerNotice} />
          {props.isSendBlocked && !props.isActiveLoading ? (
            props.blockedComposerContent
          ) : (
            <ComposerInputCard {...props} disabledSend={disabledSend} />
          )}
        </div>
        <ChatEmptyState
          visible={props.showCenteredEmptyChat}
          greetingLine={props.greetingLine}
          starters={props.emptyChatStarters}
          belowComposer={props.belowEmptyComposer}
          onStarterSelect={props.onStarterSelect}
        />
      </div>
    </>
  )
}

function ComposerInputCard(props: ChatComposerProps & { disabledSend: boolean }) {
  return (
    <div className="overflow-visible rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {props.replyContext && <ReplyContextBar replyContext={props.replyContext} setReplyContext={props.setReplyContext} />}
      <div className="p-2.5 sm:p-3">
        <input ref={props.fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => event.target.files && props.onAddImages(event.target.files)} />
        <input
          ref={props.docInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.log,.ts,.tsx,.js,.jsx,.css,.yaml,.yml,.toml,.py,.go,.rs,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          className="hidden"
          onChange={(event) => {
            props.onAddDocumentsFromPicker(event.target.files)
            event.target.value = ''
          }}
        />
        <MentionInput
          ref={props.textareaRef}
          value={props.input}
          valueRevision={props.inputRevision}
          onChange={props.onInputChange}
          onMentionsChange={props.onMentionsChange}
          onPaste={props.onPaste}
          onUploadFile={() => props.docInputRef.current?.click()}
          placeholder={props.mode === 'automate' ? 'Describe an automation, use @ to reference files, skills, automations...' : 'Ask anything, use @ to reference files, skills, automations...'}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void props.onSend()
            }
          }}
        />
        <ComposerControls {...props} />
      </div>
    </div>
  )
}

function ReplyContextBar({ replyContext, setReplyContext }: Pick<ChatComposerProps, 'replyContext' | 'setReplyContext'>) {
  if (!replyContext) return null
  return (
    <div className="flex items-start gap-2 rounded-t-2xl border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-xs text-[var(--muted)]">
      <Reply size={14} className="mt-0.5 shrink-0 text-[var(--muted)]" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--foreground)]">Replying to prior response</p>
        <p className="mt-0.5 line-clamp-2 text-[var(--muted)]">{replyContext.snippet}</p>
      </div>
      <button type="button" onClick={() => setReplyContext(null)} className="shrink-0 rounded-md p-1 text-[var(--muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--foreground)]" aria-label="Cancel reply">
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  )
}

function ComposerControls(props: ChatComposerProps & { disabledSend: boolean }) {
  return (
    <div className="mt-2 flex min-h-9 items-center gap-2">
      <AttachMenu {...props} />
      <DelayedTooltip label="Reference files, skills, automations…" side="top">
        <button type="button" onClick={() => props.textareaRef.current?.openMentionPopup()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]" aria-label="Insert mention">
          <AtSign size={16} strokeWidth={1.75} />
        </button>
      </DelayedTooltip>
      {props.generationChip && <GenerationChip chip={props.generationChip} onClear={() => props.setGenerationChip(null)} />}
      <div className="min-w-0 flex-1" />
      <ModeMenu {...props} />
      {props.isActiveLoading ? (
        <DelayedTooltip label="Stop generating" side="top">
          <button type="button" onClick={() => void props.onStop()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)] transition-colors hover:opacity-80">
            <div className="h-3.5 w-3.5 rounded-sm bg-[var(--background)]" />
          </button>
        </DelayedTooltip>
      ) : (
        <DelayedTooltip label="Send (↵) · new line (⇧↵)" side="top">
          <button type="button" onClick={() => void props.onSend()} disabled={props.disabledSend} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)] transition-colors hover:opacity-80 disabled:opacity-40">
            <Send size={17} strokeWidth={1.75} />
          </button>
        </DelayedTooltip>
      )}
    </div>
  )
}

function AttachMenu(props: ChatComposerProps) {
  return (
    <div ref={props.attachMenuRef} className="relative shrink-0">
      <DelayedTooltip label="Attach files or switch to image/video" side="top">
        <button type="button" onClick={() => props.setShowAttachMenu((value) => !value)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]">
          <Plus size={18} strokeWidth={1.75} />
        </button>
      </DelayedTooltip>
      {props.showAttachMenu && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-52 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
          <AttachMenuButton disabled={!props.supportsVision} title={!props.supportsVision ? 'You need a vision model to attach images.' : undefined} onClick={() => { props.fileInputRef.current?.click(); props.setShowAttachMenu(false) }} icon={<ImageIcon size={13} className="text-[var(--foreground)]" />} label="Attach Images" />
          <div className="my-1 border-t border-[var(--border)]" />
          <AttachMenuButton onClick={() => { props.onModeChange('image'); props.setShowAttachMenu(false) }} icon={<ImageIcon size={13} className="text-[var(--foreground)]" />} label="Generate Image" />
          <AttachMenuButton onClick={() => { props.onModeChange('video'); props.setShowAttachMenu(false) }} icon={<Video size={13} className="text-[var(--foreground)]" />} label="Generate Video" />
          <div className="my-1 border-t border-[var(--border)]" />
          <AttachMenuButton onClick={() => { props.docInputRef.current?.click(); props.setShowAttachMenu(false) }} icon={<FileText size={13} />} label="Documents" suffix="PDF, Word, text" />
        </div>
      )}
    </div>
  )
}

function AttachMenuButton({ disabled, title, onClick, icon, label, suffix }: { disabled?: boolean; title?: string; onClick: () => void; icon: React.ReactNode; label: string; suffix?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors ${disabled ? 'cursor-not-allowed text-[#bbb]' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'}`}>
      {icon}
      <span>{label}</span>
      {suffix ? <span className="ml-auto text-[10px] text-[var(--muted-light)]">{suffix}</span> : null}
    </button>
  )
}

function GenerationChip({ chip, onClear }: { chip: 'image' | 'video'; onClear: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--foreground)] px-2 py-1 text-xs font-medium text-[var(--background)]">
      {chip === 'image' ? <ImageIcon size={10} /> : <Video size={10} />}
      {chip === 'image' ? 'Image' : 'Video'}
      <button type="button" onClick={onClear} className="ml-0.5 hover:opacity-70">
        <X size={9} />
      </button>
    </div>
  )
}

function ModeMenu(props: ChatComposerProps) {
  return (
    <div ref={props.modeMenuRef} className="relative shrink-0">
      <button type="button" onClick={() => props.setShowModeMenu((value) => !value)} className={`flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs transition-colors hover:bg-[var(--surface-muted)] ${props.mode === 'automate' ? 'text-[var(--foreground)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}>
        {props.mode === 'automate' ? <Zap size={12} strokeWidth={1.75} /> : <MessageSquare size={12} strokeWidth={1.75} />}
        <span>{props.mode === 'automate' ? 'Automate' : 'Chat'}</span>
        <ChevronDown size={10} className="opacity-60" />
      </button>
      {props.showModeMenu && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-40 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
          {(['chat', 'automate'] as const).map((item) => (
            <button key={item} type="button" onClick={() => props.onNavigateMode(item)} className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-[var(--surface-muted)] ${props.mode === item ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
              {item === 'chat' ? <MessageSquare size={13} /> : <Zap size={13} strokeWidth={1.75} />}
              <span>{item === 'chat' ? 'Chat' : 'Automate'}</span>
              {props.mode === item && <Check size={11} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
