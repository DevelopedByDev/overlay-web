'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import NextImage from 'next/image'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Mathematics, { migrateMathStrings } from '@tiptap/extension-mathematics'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import Youtube from '@tiptap/extension-youtube'
import Emoji from '@tiptap/extension-emoji'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BookImage,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code,
  FolderOpen,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  Quote,
  Send,
  SmilePlus,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table2,
  TableCellsMerge,
  TableColumnsSplit,
  TableRowsSplit,
  Trash2,
  Underline as UnderlineIcon,
  Youtube as YoutubeIcon,
} from 'lucide-react'
import { common, createLowlight } from 'lowlight'
import SlashMenu, { type SlashMenuItem } from './SlashMenu'
import { useAppSettings } from './AppSettingsProvider'
import { ExportMenu } from './ExportMenu'
import {
  InlineDiffExtension,
  INLINE_DIFF_CSS,
  getPendingDiffs,
} from '@/components/notebook/InlineDiffExtension'
import type { NotebookAgentStreamEvent } from '@/lib/notebook-agent-contract'
import { noteContentFromEditor } from '@/lib/notebook-editor-blocks'
import { readStoredActModelId, ACT_MODEL_KEY } from '@/lib/chat-model-prefs'
import {
  getModelsByIntelligence,
  getChatModelDisplayName,
} from '@/lib/models'
import { MarkdownMessage } from './MarkdownMessage'

interface Note {
  _id: string
  title: string
  content: string
  tags: string[]
  projectId?: string
  createdAt: number
  updatedAt: number
}

interface CanonicalNoteFile {
  _id: string
  name: string
  content?: string
  textContent?: string
  projectId?: string
  createdAt?: number
  updatedAt?: number
}

function canonicalFileToNote(file: CanonicalNoteFile): Note {
  return {
    _id: file._id,
    title: file.name || 'Untitled',
    content: file.textContent ?? file.content ?? '',
    tags: [],
    projectId: file.projectId,
    createdAt: file.createdAt ?? Date.now(),
    updatedAt: file.updatedAt ?? Date.now(),
  }
}

type NotebookAgentUiItem =
  | { type: 'user'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; tool: string; toolInput?: Record<string, unknown> }
  | { type: 'text'; text: string }
  | { type: 'error'; text: string }

const lowlight = createLowlight(common)
const NOTEBOOK_INLINE_DIFF_STYLE_ID = 'notebook-inline-diff-styles'
const NOTES_CHANGED_EVENT = 'overlay:notes-changed'
const FILES_CHANGED_EVENT = 'overlay:files-changed'
const NOTEBOOK_INLINE_MATH_MIGRATION_REGEX = /(?<!\$)\$(?![\d\s$])([^$\n]*(?:\\[a-zA-Z@]+|[=^_{}]|[a-zA-Z]\s*[+\-*/=^_]|[+\-*/=^_]\s*[a-zA-Z]|[a-zA-Z])[^$\n]*)\$(?![\d$])/g

const markdownLineBreak = /\r\n?/g
const htmlTagPattern = /<\/?[a-z][\s\S]*>/i

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseInlineMarkdown(value: string): string {
  let html = escapeHtml(value)

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  html = html.replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:;])/g, '$1<em>$2</em>')
  html = html.replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/g, '$1<em>$2</em>')

  return html
}

function renderParagraph(lines: string[]): string {
  const content = lines.map((line) => parseInlineMarkdown(line)).join('<br />')
  return content ? `<p>${content}</p>` : ''
}

function parseTableRow(line: string): string[] | null {
  const match = line.match(/^\|(.+)\|$/)
  if (!match) return null
  return match[1].split('|').map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\|(?:\s*:?-+:?\s*\|)+$/.test(line.trim())
}

function parseTableAlignments(line: string): ('left' | 'center' | 'right' | null)[] {
  const cells = parseTableRow(line)
  if (!cells) return []
  return cells.map((cell) => {
    const trimmed = cell.trim()
    const left = trimmed.startsWith(':')
    const right = trimmed.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    if (left) return 'left'
    return null
  })
}

function renderTableRow(
  cells: string[],
  tag: 'td' | 'th',
  alignments?: ('left' | 'center' | 'right' | null)[],
): string {
  const cellsHtml = cells
    .map((cell, i) => {
      const align = alignments?.[i]
      const style = align ? ` style="text-align: ${align};"` : ''
      return `<${tag}${style}>${parseInlineMarkdown(cell)}</${tag}>`
    })
    .join('')
  return `<tr>${cellsHtml}</tr>`
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(markdownLineBreak, '\n').split('\n')
  const blocks: string[] = []
  let paragraphLines: string[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let codeLines: string[] = []
  let inCodeBlock = false
  let tableRows: string[][] = []
  let tableAlignments: ('left' | 'center' | 'right' | null)[] = []
  let inTable = false
  let tableHasHeader = false

  const flushParagraph = (): void => {
    if (paragraphLines.length > 0) {
      const paragraph = renderParagraph(paragraphLines)
      if (paragraph) blocks.push(paragraph)
      paragraphLines = []
    }
  }

  const flushList = (): void => {
    if (listType && listItems.length > 0) {
      blocks.push(`<${listType}>${listItems.join('')}</${listType}>`)
    }
    listItems = []
    listType = null
  }

  const flushCodeBlock = (): void => {
    if (inCodeBlock) {
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
      codeLines = []
      inCodeBlock = false
    }
  }

  const flushTable = (): void => {
    if (tableRows.length === 0) return

    let thead = ''
    let tbodyRows = tableRows

    if (tableHasHeader && tableRows.length > 0) {
      thead = `<thead>${renderTableRow(tableRows[0], 'th', tableAlignments)}</thead>`
      tbodyRows = tableRows.slice(1)
    }

    const tbody =
      tbodyRows.length > 0
        ? `<tbody>${tbodyRows.map((row) => renderTableRow(row, 'td', tableAlignments)).join('')}</tbody>`
        : ''

    blocks.push(`<table>${thead}${tbody}</table>`)
    tableRows = []
    tableAlignments = []
    inTable = false
    tableHasHeader = false
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    const tableRowCells = parseTableRow(line)

    if (tableRowCells) {
      if (!inTable) {
        flushParagraph()
        flushList()
        inTable = true
        tableRows = [tableRowCells]
      } else if (isTableSeparator(line)) {
        tableHasHeader = true
        tableAlignments = parseTableAlignments(line)
      } else {
        tableRows.push(tableRowCells)
      }
      continue
    }

    if (inTable) {
      flushTable()
    }

    if (line.startsWith('```')) {
      flushParagraph()
      flushList()
      if (inCodeBlock) {
        flushCodeBlock()
      } else {
        inCodeBlock = true
        codeLines = []
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(rawLine)
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${parseInlineMarkdown(headingMatch[2])}</h${level}>`)
      continue
    }

    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      flushParagraph()
      flushList()
      blocks.push('<hr />')
      continue
    }

    const blockquoteMatch = line.match(/^>\s+(.+)$/)
    if (blockquoteMatch) {
      flushParagraph()
      flushList()
      blocks.push(`<blockquote><p>${parseInlineMarkdown(blockquoteMatch[1])}</p></blockquote>`)
      continue
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(`<li><p>${parseInlineMarkdown(unorderedMatch[1])}</p></li>`)
      continue
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(`<li><p>${parseInlineMarkdown(orderedMatch[1])}</p></li>`)
      continue
    }

    flushList()
    paragraphLines.push(line)
  }

  if (inTable) {
    flushTable()
  }

  flushParagraph()
  flushList()
  flushCodeBlock()

  return blocks.join('')
}

function normalizeNoteContent(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ''
  if (htmlTagPattern.test(trimmed)) return content
  return markdownToHtml(content)
}

function promptForValue(message: string, defaultValue = ''): string | null {
  if (typeof window === 'undefined') return null
  const value = window.prompt(message, defaultValue)
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export default function NotebookEditor({
  userId: _userId,
  hideSidebar,
  projectName,
}: {
  userId: string
  hideSidebar?: boolean
  projectName?: string
}) {
  void _userId
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings } = useAppSettings()
  const showOwnSidebar = !hideSidebar && settings.useSecondarySidebar
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [showFloatingFormatToolbar, setShowFloatingFormatToolbar] = useState(false)
  const [isFormatButtonHovered, setIsFormatButtonHovered] = useState(false)
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 })
  const [slashMenuFilter, setSlashMenuFilter] = useState('')
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)
  const [agentPanelOpen, setAgentPanelOpen] = useState(false)
  const [agentItems, setAgentItems] = useState<NotebookAgentUiItem[]>([])
  const [agentInput, setAgentInput] = useState('')
  const [agentRunning, setAgentRunning] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState<string>(() => readStoredActModelId())
  const [showModelPicker, setShowModelPicker] = useState(false)
  const notebookAgentAbortRef = useRef<AbortController | null>(null)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  const activeNoteRef = useRef<Note | null>(null)
  const titleRef = useRef('')
  const isDirtyRef = useRef(false)
  const pendingNoteIdRef = useRef<string | null>(null)
  const pendingTitleRef = useRef('')
  const pendingContentRef = useRef('')
  const flushSaveRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById(NOTEBOOK_INLINE_DIFF_STYLE_ID)) return
    const el = document.createElement('style')
    el.id = NOTEBOOK_INLINE_DIFF_STYLE_ID
    el.textContent = INLINE_DIFF_CSS
    document.head.appendChild(el)
  }, [])

  useEffect(() => {
    titleRef.current = title
  }, [title])

  useEffect(() => {
    activeNoteRef.current = activeNote
  }, [activeNote])

  useEffect(() => {
    notebookAgentAbortRef.current?.abort()
    notebookAgentAbortRef.current = null
    setAgentRunning(false)
    setAgentItems([])
  }, [activeNote?._id])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing... (type / for commands)',
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
        includeChildren: true,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }),
      Mathematics.configure({
        katexOptions: { throwOnError: false },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Typography,
      Subscript,
      Superscript,
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto'],
      }),
      TextStyle,
      Youtube.configure({
        controls: true,
        nocookie: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Emoji.configure({
        enableEmoticons: true,
      }),
      InlineDiffExtension,
    ],
    content: '',
    immediatelyRender: false,
    onCreate: ({ editor: currentEditor }) => {
      migrateMathStrings(currentEditor, NOTEBOOK_INLINE_MATH_MIGRATION_REGEX)
    },
    onUpdate: ({ editor: currentEditor }) => {
      migrateMathStrings(currentEditor, NOTEBOOK_INLINE_MATH_MIGRATION_REGEX)

      if (activeNoteRef.current) {
        isDirtyRef.current = true
        pendingNoteIdRef.current = activeNoteRef.current._id
        pendingTitleRef.current = titleRef.current
        pendingContentRef.current = currentEditor.getHTML()
        setIsDirty(true)
      }

      const { selection } = currentEditor.state
      const { $from } = selection
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
      const slashQueryMatch = textBefore.match(/(?:^|\s)\/([^\s/]*)$/)

      if (slashQueryMatch) {
        const coords = currentEditor.view.coordsAtPos(selection.from)
        const nextLeft = Math.max(8, Math.min(coords.left, window.innerWidth - 296))
        const nextTop = Math.max(8, Math.min(coords.bottom + 8, window.innerHeight - 340))

        setSlashMenuPosition({ top: nextTop, left: nextLeft })
        setSlashMenuFilter(slashQueryMatch[1])
        setShowSlashMenu(true)
      } else {
        setShowSlashMenu(false)
        setSlashMenuFilter('')
      }
    },
    editorProps: {
      attributes: {
        class: 'app-note-editor',
      },
    },
  })

  const slashMenuItems = useMemo<SlashMenuItem[]>(
    () => [
      {
        title: 'Heading 1',
        description: 'Large section heading',
        icon: <Heading1 size={16} />,
        command: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
        category: 'nodes',
      },
      {
        title: 'Heading 2',
        description: 'Medium section heading',
        icon: <Heading2 size={16} />,
        command: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
        category: 'nodes',
      },
      {
        title: 'Heading 3',
        description: 'Small section heading',
        icon: <Heading3 size={16} />,
        command: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
        category: 'nodes',
      },
      {
        title: 'Bullet List',
        description: 'Create a simple bullet list',
        icon: <List size={16} />,
        command: () => editor?.chain().focus().toggleBulletList().run(),
        category: 'nodes',
      },
      {
        title: 'Numbered List',
        description: 'Create a numbered list',
        icon: <ListOrdered size={16} />,
        command: () => editor?.chain().focus().toggleOrderedList().run(),
        category: 'nodes',
      },
      {
        title: 'Task List',
        description: 'Create a task list with checkboxes',
        icon: <ListTodo size={16} />,
        command: () => editor?.chain().focus().toggleTaskList().run(),
        category: 'nodes',
      },
      {
        title: 'Blockquote',
        description: 'Pull text out as a quote',
        icon: <Quote size={16} />,
        command: () => editor?.chain().focus().toggleBlockquote().run(),
        category: 'nodes',
      },
      {
        title: 'Code Block',
        description: 'Add a code block with syntax highlighting',
        icon: <Code size={16} />,
        command: () => editor?.chain().focus().toggleCodeBlock().run(),
        category: 'nodes',
      },
      {
        title: 'Divider',
        description: 'Insert a horizontal rule',
        icon: <Minus size={16} />,
        command: () => editor?.chain().focus().setHorizontalRule().run(),
        category: 'nodes',
      },
      {
        title: 'Inline Equation',
        description: 'Insert inline math markup',
        icon: <Code size={16} />,
        command: () => editor?.chain().focus().insertContent('$E=mc^2$').run(),
        category: 'nodes',
      },
      {
        title: 'Table',
        description: 'Insert a 3x3 table',
        icon: <Table2 size={16} />,
        command: () =>
          editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        category: 'nodes',
      },
      {
        title: 'Image',
        description: 'Embed an image from a URL',
        icon: <BookImage size={16} />,
        command: () => {
          const src = promptForValue('Enter image URL:')
          if (src) editor?.chain().focus().setImage({ src }).run()
        },
        category: 'nodes',
      },
      {
        title: 'YouTube Video',
        description: 'Embed a YouTube video',
        icon: <YoutubeIcon size={16} />,
        command: () => {
          const src = promptForValue('Enter YouTube URL:')
          if (src) editor?.chain().focus().setYoutubeVideo({ src }).run()
        },
        category: 'nodes',
      },
      {
        title: 'Add Row Above',
        description: 'Add a row above the current row',
        icon: <TableRowsSplit size={16} />,
        command: () => editor?.chain().focus().addRowBefore().run(),
        category: 'table',
      },
      {
        title: 'Add Row Below',
        description: 'Add a row below the current row',
        icon: <TableRowsSplit size={16} />,
        command: () => editor?.chain().focus().addRowAfter().run(),
        category: 'table',
      },
      {
        title: 'Delete Row',
        description: 'Delete the current row',
        icon: <Trash2 size={16} />,
        command: () => editor?.chain().focus().deleteRow().run(),
        category: 'table',
      },
      {
        title: 'Add Column Before',
        description: 'Add a column before the current column',
        icon: <TableColumnsSplit size={16} />,
        command: () => editor?.chain().focus().addColumnBefore().run(),
        category: 'table',
      },
      {
        title: 'Add Column After',
        description: 'Add a column after the current column',
        icon: <TableColumnsSplit size={16} />,
        command: () => editor?.chain().focus().addColumnAfter().run(),
        category: 'table',
      },
      {
        title: 'Delete Column',
        description: 'Delete the current column',
        icon: <Trash2 size={16} />,
        command: () => editor?.chain().focus().deleteColumn().run(),
        category: 'table',
      },
      {
        title: 'Merge Cells',
        description: 'Merge the current selection',
        icon: <TableCellsMerge size={16} />,
        command: () => editor?.chain().focus().mergeCells().run(),
        category: 'table',
      },
      {
        title: 'Split Cell',
        description: 'Split the current cell',
        icon: <TableColumnsSplit size={16} />,
        command: () => editor?.chain().focus().splitCell().run(),
        category: 'table',
      },
      {
        title: 'Delete Table',
        description: 'Delete the entire table',
        icon: <TableRowsSplit size={16} />,
        command: () => editor?.chain().focus().deleteTable().run(),
        category: 'table',
      },
      {
        title: 'Bold',
        description: 'Make text bold',
        icon: <Bold size={16} />,
        command: () => editor?.chain().focus().toggleBold().run(),
        category: 'marks',
      },
      {
        title: 'Italic',
        description: 'Make text italic',
        icon: <Italic size={16} />,
        command: () => editor?.chain().focus().toggleItalic().run(),
        category: 'marks',
      },
      {
        title: 'Underline',
        description: 'Underline text',
        icon: <UnderlineIcon size={16} />,
        command: () => editor?.chain().focus().toggleUnderline().run(),
        category: 'marks',
      },
      {
        title: 'Strikethrough',
        description: 'Strike through text',
        icon: <Strikethrough size={16} />,
        command: () => editor?.chain().focus().toggleStrike().run(),
        category: 'marks',
      },
      {
        title: 'Inline Code',
        description: 'Inline code formatting',
        icon: <Code size={16} />,
        command: () => editor?.chain().focus().toggleCode().run(),
        category: 'marks',
      },
      {
        title: 'Highlight',
        description: 'Highlight text',
        icon: <Highlighter size={16} />,
        command: () => editor?.chain().focus().toggleHighlight().run(),
        category: 'marks',
      },
      {
        title: 'Align Left',
        description: 'Align text to the left',
        icon: <AlignLeft size={16} />,
        command: () => editor?.chain().focus().setTextAlign('left').run(),
        category: 'marks',
      },
      {
        title: 'Align Center',
        description: 'Center text',
        icon: <AlignCenter size={16} />,
        command: () => editor?.chain().focus().setTextAlign('center').run(),
        category: 'marks',
      },
      {
        title: 'Align Right',
        description: 'Align text to the right',
        icon: <AlignRight size={16} />,
        command: () => editor?.chain().focus().setTextAlign('right').run(),
        category: 'marks',
      },
      {
        title: 'Subscript',
        description: 'Make text subscript',
        icon: <SubscriptIcon size={16} />,
        command: () => editor?.chain().focus().toggleSubscript().run(),
        category: 'marks',
      },
      {
        title: 'Superscript',
        description: 'Make text superscript',
        icon: <SuperscriptIcon size={16} />,
        command: () => editor?.chain().focus().toggleSuperscript().run(),
        category: 'marks',
      },
      {
        title: 'Emoji',
        description: 'Insert an emoji',
        icon: <SmilePlus size={16} />,
        command: () => {
          const emoji = promptForValue('Enter an emoji:', '🙂')
          if (emoji) editor?.chain().focus().insertContent(emoji).run()
        },
        category: 'marks',
      },
    ],
    [editor],
  )

  const filteredSlashItems = useMemo(() => {
    if (!slashMenuFilter) return slashMenuItems
    const query = slashMenuFilter.toLowerCase()
    return slashMenuItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query),
    )
  }, [slashMenuFilter, slashMenuItems])

  const loadNotes = useCallback(async () => {
    if (hideSidebar) return
    try {
      const res = await fetch('/api/app/files?kind=note')
      if (res.ok) {
        const data = (await res.json()) as CanonicalNoteFile[]
        setNotes(data.map(canonicalFileToNote))
      }
    } catch {
      // ignore
    }
  }, [hideSidebar])

  const openNote = useCallback((note: Note) => {
    flushSaveRef.current()
    setIsDirty(false)
    setActiveNote(note)
    setTitle(note.title)
    if (!hideSidebar) {
      router.replace(`/app/notes?id=${encodeURIComponent(note._id)}`)
    }
  }, [hideSidebar, router])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) flushSaveRef.current()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    return () => { flushSaveRef.current() }
  }, [])

  useEffect(() => {
    if (!showModelPicker) return
    function handleClickOutside(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowModelPicker(false)
    }
    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showModelPicker])

  const idParam = searchParams?.get('id') ?? null
  useEffect(() => {
    if (!idParam) return
    const noteId = idParam

    if (!hideSidebar && notes.length > 0) {
      const existing = notes.find((note) => note._id === noteId)
      if (existing && activeNote?._id !== noteId) {
        openNote(existing)
        return
      }
    }

    let cancelled = false
    async function loadNoteById() {
      try {
        const res = await fetch(`/api/app/files?fileId=${encodeURIComponent(noteId)}`)
        if (!res.ok) return
        const note = canonicalFileToNote((await res.json()) as CanonicalNoteFile)
        if (!cancelled) {
          if (hideSidebar) setNotes([note])
          openNote(note)
        }
      } catch {
        // ignore
      }
    }

    void loadNoteById()
    return () => {
      cancelled = true
    }
  }, [activeNote?._id, hideSidebar, idParam, notes, openNote])

  useEffect(() => {
    if (!editor) return
    if (!activeNote) {
      editor.commands.clearContent()
      return
    }

    editor.commands.setContent(normalizeNoteContent(activeNote.content || ''))
    migrateMathStrings(editor, NOTEBOOK_INLINE_MATH_MIGRATION_REGEX)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, activeNote?._id])

  useEffect(() => {
    setSelectedSlashIndex(0)
  }, [slashMenuFilter, showSlashMenu])

  const executeSlashCommand = useCallback(
    (item: SlashMenuItem) => {
      if (!editor) return

      const { selection } = editor.state
      const { $from } = selection
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
      const slashIndex = textBefore.lastIndexOf('/')

      if (slashIndex !== -1) {
        const deleteFrom = $from.pos - (textBefore.length - slashIndex)
        editor.chain().focus().deleteRange({ from: deleteFrom, to: $from.pos }).run()
      }

      item.command()
      setShowSlashMenu(false)
      setSlashMenuFilter('')
    },
    [editor],
  )

  useEffect(() => {
    if (!showSlashMenu) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (filteredSlashItems.length === 0) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setShowSlashMenu(false)
          setSlashMenuFilter('')
        }
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedSlashIndex((prev) => (prev < filteredSlashItems.length - 1 ? prev + 1 : 0))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedSlashIndex((prev) => (prev > 0 ? prev - 1 : filteredSlashItems.length - 1))
      } else if (event.key === 'Enter') {
        if (!filteredSlashItems[selectedSlashIndex]) return
        event.preventDefault()
        executeSlashCommand(filteredSlashItems[selectedSlashIndex])
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setShowSlashMenu(false)
        setSlashMenuFilter('')
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [showSlashMenu, filteredSlashItems, selectedSlashIndex, executeSlashCommand])

  function flushSave() {
    if (!isDirtyRef.current || !pendingNoteIdRef.current) return
    isDirtyRef.current = false
    setIsDirty(false)
    const noteId = pendingNoteIdRef.current
    const noteTitle = pendingTitleRef.current
    const content = pendingContentRef.current
    void fetch('/api/app/files', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: noteId, name: noteTitle, textContent: content }),
      keepalive: true,
    }).then(async (res) => {
      if (!res.ok) return
      const data = (await res.json()) as { file?: CanonicalNoteFile }
      if (data.file) {
        const note = canonicalFileToNote(data.file)
        setNotes((prev) => {
          const next = prev.filter((item) => item._id !== note._id)
          return [note, ...next]
        })
        window.dispatchEvent(new CustomEvent(NOTES_CHANGED_EVENT, { detail: { note } }))
        window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
      }
    }).catch(() => {})
  }
  flushSaveRef.current = flushSave

  const stopNotebookAgent = useCallback(() => {
    notebookAgentAbortRef.current?.abort()
    notebookAgentAbortRef.current = null
    setAgentRunning(false)
  }, [])

  const runNotebookAgent = useCallback(async () => {
    if (!editor || !activeNote || agentRunning) return
    const message = agentInput.trim()
    if (!message) return
    const noteContent = noteContentFromEditor(editor)
    const modelId = selectedModelId

    setAgentItems((prev) => [...prev, { type: 'user', text: message }])
    setAgentInput('')

    const ac = new AbortController()
    notebookAgentAbortRef.current = ac
    setAgentRunning(true)

    try {
      const res = await fetch('/api/app/notebook-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: ac.signal,
        body: JSON.stringify({
          noteContent,
          noteTitle: title.trim() || 'Untitled',
          message,
          modelId,
          projectId: activeNote.projectId,
        }),
      })

      if (!res.ok) {
        let errText = `Request failed (${res.status})`
        try {
          const j = (await res.json()) as { message?: string; error?: string }
          errText = j.message || j.error || errText
        } catch {
          try {
            errText = (await res.text()) || errText
          } catch {
            /* ignore */
          }
        }
        setAgentItems((prev) => [...prev, { type: 'error', text: errText }])
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setAgentItems((prev) => [...prev, { type: 'error', text: 'No response body' }])
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let evt: NotebookAgentStreamEvent
          try {
            evt = JSON.parse(trimmed) as NotebookAgentStreamEvent
          } catch {
            continue
          }
          switch (evt.type) {
            case 'thinking':
              if (evt.thinking?.trim()) {
                setAgentItems((prev) => [...prev, { type: 'thinking', text: evt.thinking! }])
              }
              break
            case 'tool_call':
              setAgentItems((prev) => [
                ...prev,
                { type: 'tool_call', tool: evt.tool ?? 'tool', toolInput: evt.toolInput },
              ])
              break
            case 'text':
              if (evt.text?.trim()) {
                setAgentItems((prev) => [...prev, { type: 'text', text: evt.text! }])
              }
              break
            case 'edit_proposal': {
              const edit = evt.edit
              if (!edit) break
              editor.chain().focus().addDiffProposal(edit).run()
              break
            }
            case 'error':
              setAgentItems((prev) => [
                ...prev,
                { type: 'error', text: evt.error ?? 'Unknown error' },
              ])
              break
            case 'done':
              break
            default:
              break
          }
        }
      }
    } catch (e) {
      if (ac.signal.aborted) return
      const msg = e instanceof Error ? e.message : String(e)
      setAgentItems((prev) => [...prev, { type: 'error', text: msg }])
    } finally {
      notebookAgentAbortRef.current = null
      setAgentRunning(false)
    }
  }, [activeNote, agentInput, agentRunning, editor, selectedModelId, title])

  async function createNote() {
    const res = await fetch('/api/app/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'note', name: 'Untitled', textContent: '' }),
    })
    if (res.ok) {
      const data = (await res.json()) as { id: string; file?: CanonicalNoteFile }
      if (data.file) {
        const note = canonicalFileToNote(data.file)
        setNotes((prev) => [note, ...prev.filter((item) => item._id !== note._id)])
        window.dispatchEvent(new CustomEvent(NOTES_CHANGED_EVENT, { detail: { note } }))
        window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
        openNote(note)
        return
      }
      const note = {
        _id: data.id,
        title: 'Untitled',
        content: '',
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setNotes((prev) => [note, ...prev.filter((item) => item._id !== note._id)])
      window.dispatchEvent(new CustomEvent(NOTES_CHANGED_EVENT, { detail: { note } }))
      window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
      await loadNotes()
      openNote(note)
    }
  }

  async function deleteNote(noteId: string, event: React.MouseEvent) {
    event.stopPropagation()
    await fetch(`/api/app/files?fileId=${noteId}`, { method: 'DELETE' })
    if (activeNote?._id === noteId) {
      setActiveNote(null)
      setTitle('')
      editor?.commands.clearContent()
      if (!hideSidebar) {
        router.replace('/app/notes')
      }
    }
    setNotes((prev) => prev.filter((note) => note._id !== noteId))
    window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT))
    if (showOwnSidebar) {
      await loadNotes()
    }
  }

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newTitle = event.target.value
    setTitle(newTitle)
    titleRef.current = newTitle
    if (activeNote) {
      isDirtyRef.current = true
      pendingNoteIdRef.current = activeNote._id
      pendingTitleRef.current = newTitle
      pendingContentRef.current = editor?.getHTML() || ''
      setIsDirty(true)
    }
  }

  const floatingToolbarButtonClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40'

  const floatingToolbarActiveButtonClass =
    'bg-[var(--surface-subtle)] text-[var(--foreground)]'

  const floatingToolbarDividerClass = 'mx-1 h-5 w-px shrink-0 bg-[var(--border)]'

  return (
    <div className="flex h-full flex-col">
      {/* Header - shows note title when active, otherwise "Notes" */}
      {activeNote ? (
        <div className="flex h-16 shrink-0 border-b border-[var(--border)]">
          {/* Left side - Note title section */}
          <div className="flex flex-1 items-center justify-between px-6">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="Note title..."
              className="flex-1 bg-transparent font-medium text-xl text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
              style={{ fontFamily: 'var(--font-serif)' }}
            />
            <div className="ml-3 flex shrink-0 items-center gap-2">
              {projectName && (
                <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                  <FolderOpen size={9} />
                  {projectName}
                </span>
              )}
              {isDirty && <span className="text-[11px] text-[var(--muted-light)]">Unsaved</span>}
              {activeNote && (
                <ExportMenu
                  type="note"
                  title={title || 'Untitled'}
                  content={editor?.getHTML() || activeNote.content || ''}
                  metadata={{
                    createdAt: activeNote.createdAt,
                    updatedAt: activeNote.updatedAt,
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => setAgentPanelOpen((open) => !open)}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)] ${
                  agentPanelOpen ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]' : ''
                }`}
                aria-label={agentPanelOpen ? 'Close note assistant' : 'Open note assistant'}
                title="Note assistant"
              >
                <MessageCircle size={16} />
              </button>
            </div>
          </div>
          {/* Right side - Assistant header (only when open) */}
          {agentPanelOpen && (
            <div className="flex w-[min(400px,92vw)] shrink-0 items-center justify-between gap-3 border-l border-[var(--border)] px-4">
              <span className="text-xs font-medium text-[var(--foreground)]">Assistant</span>
              <div className="flex items-center gap-2">
                {editor && getPendingDiffs(editor).length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().acceptAllDiffs().run()}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] text-[var(--foreground)] hover:bg-[var(--surface-subtle)]"
                    >
                      Accept all
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().rejectAllDiffs().run()}
                      className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                    >
                      Reject all
                    </button>
                  </>
                )}
                <div ref={modelPickerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => !agentRunning && setShowModelPicker((v) => !v)}
                    disabled={agentRunning}
                    className={`flex h-8 min-h-8 items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-0 text-left text-xs leading-none md:py-1 ${
                      agentRunning ? 'cursor-not-allowed text-[var(--muted-light)]' : 'text-[var(--muted)] hover:bg-[var(--border)]'
                    }`}
                  >
                    <span className="min-w-0 truncate">{getChatModelDisplayName(selectedModelId)}</span>
                    <ChevronDown size={11} className="shrink-0" />
                  </button>
                  {showModelPicker && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-1.5rem)] rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
                      <div className="max-h-72 overflow-y-auto">
                        {getModelsByIntelligence(false).map((m) => {
                          const isSel = m.id === selectedModelId
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedModelId(m.id)
                                try {
                                  localStorage.setItem(ACT_MODEL_KEY, m.id)
                                } catch { /* ignore */ }
                                setShowModelPicker(false)
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[var(--surface-muted)] ${
                                isSel ? 'text-[var(--foreground)] font-medium' : 'text-[var(--muted)]'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {isSel ? <Check size={10} /> : <span className="w-[10px] inline-block" />}
                                {m.name}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] px-6">
          <div className="shrink-0">
            <h2 className="text-sm font-medium text-[var(--foreground)]">Notes</h2>
          </div>
          <div className="flex-1" />
          <button
            onClick={createNote}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition-colors"
          >
            <Plus size={14} />
            New note
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {showOwnSidebar && (
          <div className="w-52 h-full flex flex-col border-r border-[var(--border)] bg-[var(--sidebar-surface)]">
            <div className="flex h-16 items-center border-b border-[var(--border)] px-3">
              <button
                onClick={createNote}
                className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-md text-sm border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition-colors"
              >
                <Plus size={13} />
                New note
              </button>
            </div>
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {notes.map((note) => (
              <div
                key={note._id}
                onClick={() => openNote(note)}
                className={`group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
                  activeNote?._id === note._id
                    ? 'bg-[var(--surface-subtle)] text-[var(--foreground)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <span className="text-xs truncate">{note.title || 'Untitled'}</span>
                <button
                  onClick={(event) => void deleteNote(note._id, event)}
                  className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--border)] group-hover:opacity-100"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeNote ? (
          <>
            <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div className="h-full overflow-y-auto px-6 py-4">
                <EditorContent editor={editor} />
              </div>

              <div className="absolute bottom-5 right-5 z-30 flex max-w-[calc(100%-2.5rem)] items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => setShowFloatingFormatToolbar((prev) => !prev)}
                  onMouseEnter={() => setIsFormatButtonHovered(true)}
                  onMouseLeave={() => setIsFormatButtonHovered(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                  aria-label={showFloatingFormatToolbar ? 'Close formatting toolbar' : 'Open formatting toolbar'}
                  aria-expanded={showFloatingFormatToolbar}
                  title={showFloatingFormatToolbar ? 'Close formatting toolbar' : 'Formatting'}
                >
                  {showFloatingFormatToolbar ? (
                    <ChevronRight size={16} />
                  ) : isFormatButtonHovered ? (
                    <ChevronLeft size={16} />
                  ) : (
                    <Pencil size={16} />
                  )}
                </button>

                {showFloatingFormatToolbar && (
                  <>
                    <div className={floatingToolbarDividerClass} />
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('heading', { level: 1 }) ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Heading 1"
                      title="Heading 1"
                    >
                      <Heading1 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('heading', { level: 2 }) ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Heading 2"
                      title="Heading 2"
                    >
                      <Heading2 size={15} />
                    </button>
                    <div className={floatingToolbarDividerClass} />
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('bold') ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Bold"
                      title="Bold"
                    >
                      <Bold size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleItalic().run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('italic') ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Italic"
                      title="Italic"
                    >
                      <Italic size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleUnderline().run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('underline') ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Underline"
                      title="Underline"
                    >
                      <UnderlineIcon size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleStrike().run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('strike') ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Strikethrough"
                      title="Strikethrough"
                    >
                      <Strikethrough size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleCode().run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('code') ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Inline code"
                      title="Inline code"
                    >
                      <Code size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleHighlight().run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('highlight') ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Highlight"
                      title="Highlight"
                    >
                      <Highlighter size={15} />
                    </button>
                    <div className={floatingToolbarDividerClass} />
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleBulletList().run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('bulletList') ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Bullet list"
                      title="Bullet list"
                    >
                      <List size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('orderedList') ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Numbered list"
                      title="Numbered list"
                    >
                      <ListOrdered size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().toggleTaskList().run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive('taskList') ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Task list"
                      title="Task list"
                    >
                      <ListTodo size={15} />
                    </button>
                    <div className={floatingToolbarDividerClass} />
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive({ textAlign: 'left' }) ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Align left"
                      title="Align left"
                    >
                      <AlignLeft size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive({ textAlign: 'center' }) ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Align center"
                      title="Align center"
                    >
                      <AlignCenter size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                      className={`${floatingToolbarButtonClass} ${
                        editor?.isActive({ textAlign: 'right' }) ? floatingToolbarActiveButtonClass : ''
                      }`}
                      aria-label="Align right"
                      title="Align right"
                    >
                      <AlignRight size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
            {agentPanelOpen && (
              <aside
                className="flex w-[min(400px,92vw)] shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--surface)]"
                aria-label="Note assistant"
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
                  {agentItems.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-[var(--muted)]">Ask about this note or describe edits...</p>
                    </div>
                  )}
                  {agentItems.map((item, idx) => {
                    if (item.type === 'user') {
                      return (
                        <div key={idx} className="flex justify-end">
                          <div className="chat-user-bubble min-w-0 max-w-[min(92%,36rem)] break-words select-text rounded-2xl rounded-br-sm border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-sm leading-relaxed text-[var(--foreground)] sm:max-w-[75%]">
                            <span className="whitespace-pre-wrap">{item.text}</span>
                          </div>
                        </div>
                      )
                    }
                    if (item.type === 'thinking') {
                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                          <span
                            className="overlay-stream-marker overlay-stream-marker--standalone h-4 w-4"
                            aria-label={item.text}
                            role="img"
                          />
                        </div>
                      )
                    }
                    if (item.type === 'tool_call') {
                      const toolLabel = item.tool === 'search_knowledge' ? 'Searching knowledge' :
                        item.tool === 'read_note' ? 'Reading note' :
                        item.tool === 'propose_edit' ? 'Proposing edit' :
                        item.tool === 'finish' ? 'Done' : item.tool
                      const isRunning = agentRunning && idx === agentItems.length - 1
                      return (
                        <div key={idx} className="flex w-full max-w-[min(100%,36rem)] items-stretch gap-2.5 py-1 text-[13px] leading-snug">
                          <div className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                            <div className="relative z-[1] shrink-0 rounded-full bg-[var(--background)] p-px">
                              <NextImage
                                src="/assets/overlay-logo.png"
                                alt=""
                                width={14}
                                height={14}
                                className="mt-0.5 size-3.5 shrink-0 select-none"
                                draggable={false}
                              />
                            </div>
                          </div>
                          <span className={isRunning ? 'tool-line-shimmer' : 'text-[var(--tool-line-label)]'}>
                            {toolLabel}
                          </span>
                        </div>
                      )
                    }
                    if (item.type === 'text') {
                      return (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <MarkdownMessage
                              text={item.text ?? ''}
                              isStreaming={agentRunning && idx === agentItems.length - 1}
                            />
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div key={idx} className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-700 dark:text-red-300">
                        {item.text}
                      </div>
                    )
                  })}
                </div>
                <div className="shrink-0 p-3">
                  <div className="overflow-visible rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <div className="p-2.5">
                      <textarea
                        value={agentInput}
                        onChange={(e) => setAgentInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            if (!agentRunning && agentInput.trim()) void runNotebookAgent()
                          }
                        }}
                        placeholder="Ask about this note or describe edits..."
                        rows={1}
                        disabled={agentRunning}
                        className="w-full min-h-11 resize-none border-0 bg-transparent px-0.5 py-1 text-sm leading-6 text-[var(--foreground)] shadow-none outline-none ring-0 placeholder:text-[var(--muted-light)] focus:ring-0"
                      />
                      <div className="mt-2 flex min-h-9 items-center justify-end gap-2">
                        {agentRunning ? (
                          <button
                            type="button"
                            onClick={stopNotebookAgent}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)] transition-colors hover:opacity-80"
                            aria-label="Stop"
                          >
                            <div className="h-3.5 w-3.5 rounded-sm bg-[var(--background)]" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void runNotebookAgent()}
                            disabled={!agentInput.trim()}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--foreground)] text-[var(--background)] transition-colors hover:opacity-80 disabled:opacity-40"
                            aria-label="Send"
                          >
                            <Send size={17} strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            )}
            </div>
            <SlashMenu
              showSlashMenu={showSlashMenu}
              slashMenuPosition={slashMenuPosition}
              slashMenuFilter={slashMenuFilter}
              selectedSlashIndex={selectedSlashIndex}
              setSelectedSlashIndex={setSelectedSlashIndex}
              filteredSlashItems={filteredSlashItems}
              executeSlashCommand={executeSlashCommand}
              onClose={() => {
                setShowSlashMenu(false)
                setSlashMenuFilter('')
              }}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="mb-2 text-3xl text-[var(--foreground)]" style={{ fontFamily: 'var(--font-serif)' }}>
                notes
              </p>
              <p className="text-sm text-[var(--muted)] mb-4">Select a note or create a new one</p>
              <button
                onClick={createNote}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition-colors"
              >
                <Plus size={14} />
                New Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  )
}
