'use client'

import type { Editor } from '@tiptap/react'
import type React from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  Pilcrow,
  Sparkles,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from 'lucide-react'

type ToolbarAction = {
  id: string
  label: string
  icon: React.ReactNode
  active?: (editor: Editor) => boolean
  run: (editor: Editor) => void
}

export const textStyleActions: ToolbarAction[] = [
  { id: 'paragraph', label: 'Paragraph', icon: <Pilcrow size={14} />, active: (editor) => editor.isActive('paragraph'), run: (editor) => editor.chain().focus().setParagraph().run() },
  { id: 'h1', label: 'Heading 1', icon: <span className="text-[11px] font-semibold">H1</span>, active: (editor) => editor.isActive('heading', { level: 1 }), run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'h2', label: 'Heading 2', icon: <span className="text-[11px] font-semibold">H2</span>, active: (editor) => editor.isActive('heading', { level: 2 }), run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'h3', label: 'Heading 3', icon: <span className="text-[11px] font-semibold">H3</span>, active: (editor) => editor.isActive('heading', { level: 3 }), run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'bullet', label: 'Bullet list', icon: <List size={14} />, active: (editor) => editor.isActive('bulletList'), run: (editor) => editor.chain().focus().toggleBulletList().run() },
]

export const markActions: ToolbarAction[] = [
  { id: 'bold', label: 'Bold', icon: <Bold size={14} />, active: (editor) => editor.isActive('bold'), run: (editor) => editor.chain().focus().toggleBold().run() },
  { id: 'italic', label: 'Italic', icon: <Italic size={14} />, active: (editor) => editor.isActive('italic'), run: (editor) => editor.chain().focus().toggleItalic().run() },
  { id: 'underline', label: 'Underline', icon: <Underline size={14} />, active: (editor) => editor.isActive('underline'), run: (editor) => editor.chain().focus().toggleUnderline().run() },
  { id: 'strike', label: 'Strikethrough', icon: <Strikethrough size={14} />, active: (editor) => editor.isActive('strike'), run: (editor) => editor.chain().focus().toggleStrike().run() },
  { id: 'code', label: 'Inline code', icon: <Code size={14} />, active: (editor) => editor.isActive('code'), run: (editor) => editor.chain().focus().toggleCode().run() },
]

export const alignActions: ToolbarAction[] = [
  { id: 'left', label: 'Align left', icon: <AlignLeft size={14} />, active: (editor) => editor.isActive({ textAlign: 'left' }), run: (editor) => editor.chain().focus().setTextAlign('left').run() },
  { id: 'center', label: 'Align center', icon: <AlignCenter size={14} />, active: (editor) => editor.isActive({ textAlign: 'center' }), run: (editor) => editor.chain().focus().setTextAlign('center').run() },
  { id: 'right', label: 'Align right', icon: <AlignRight size={14} />, active: (editor) => editor.isActive({ textAlign: 'right' }), run: (editor) => editor.chain().focus().setTextAlign('right').run() },
  { id: 'justify', label: 'Justify', icon: <AlignJustify size={14} />, active: (editor) => editor.isActive({ textAlign: 'justify' }), run: (editor) => editor.chain().focus().setTextAlign('justify').run() },
]

export const moreActions: ToolbarAction[] = [
  { id: 'highlight', label: 'Highlight', icon: <Highlighter size={14} />, active: (editor) => editor.isActive('highlight'), run: (editor) => editor.chain().focus().toggleHighlight().run() },
  { id: 'subscript', label: 'Subscript', icon: <Subscript size={14} />, active: (editor) => editor.isActive('subscript'), run: (editor) => editor.chain().focus().toggleSubscript().run() },
  { id: 'superscript', label: 'Superscript', icon: <Superscript size={14} />, active: (editor) => editor.isActive('superscript'), run: (editor) => editor.chain().focus().toggleSuperscript().run() },
]

export function ToolbarButton({
  editor,
  action,
}: {
  editor: Editor
  action: ToolbarAction
}) {
  const active = action.active?.(editor) ?? false
  return (
    <button
      type="button"
      title={action.label}
      aria-label={action.label}
      onClick={() => action.run(editor)}
      className={`inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-2 text-xs transition-colors ${
        active
          ? 'bg-[var(--foreground)] text-[var(--background)]'
          : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]'
      }`}
    >
      {action.icon}
      {action.id === 'paragraph' ? <span>Text</span> : null}
    </button>
  )
}

export function ImproveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--foreground)] hover:bg-[var(--surface-subtle)]"
    >
      <Sparkles size={13} />
      Improve
    </button>
  )
}

export function setLink(editor: Editor) {
  const previous = editor.getAttributes('link').href as string | undefined
  const href = window.prompt('Paste link URL', previous ?? '')
  if (href === null) return
  if (!href.trim()) {
    editor.chain().focus().unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
}

export const linkAction: ToolbarAction = {
  id: 'link',
  label: 'Link',
  icon: <LinkIcon size={14} />,
  active: (editor) => editor.isActive('link'),
  run: setLink,
}
