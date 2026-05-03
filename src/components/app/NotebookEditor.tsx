'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Mathematics from '@tiptap/extension-mathematics'
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
  Minus,
  Plus,
  Quote,
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

interface Note {
  _id: string
  title: string
  content: string
  tags: string[]
  projectId?: string
  createdAt: number
  updatedAt: number
}

const lowlight = createLowlight(common)
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
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 })
  const [slashMenuFilter, setSlashMenuFilter] = useState('')
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)
  const activeNoteRef = useRef<Note | null>(null)
  const titleRef = useRef('')
  const isDirtyRef = useRef(false)
  const pendingNoteIdRef = useRef<string | null>(null)
  const pendingTitleRef = useRef('')
  const pendingContentRef = useRef('')
  const flushSaveRef = useRef<() => void>(() => {})

  useEffect(() => {
    activeNoteRef.current = activeNote
  }, [activeNote])

  useEffect(() => {
    titleRef.current = title
  }, [title])

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
    ],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
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
      const res = await fetch('/api/app/notes')
      if (res.ok) {
        const data = (await res.json()) as Note[]
        setNotes(data)
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
        const res = await fetch(`/api/app/notes?noteId=${encodeURIComponent(noteId)}`)
        if (!res.ok) return
        const note = (await res.json()) as Note
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
    void fetch('/api/app/notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId, title: noteTitle, content }),
      keepalive: true,
    }).then(async (res) => {
      if (!res.ok) return
      const data = (await res.json()) as { note?: Note }
      if (data.note) {
        setNotes((prev) => {
          const next = prev.filter((note) => note._id !== data.note!._id)
          return [data.note!, ...next]
        })
      }
    }).catch(() => {})
  }
  flushSaveRef.current = flushSave

  async function createNote() {
    const res = await fetch('/api/app/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', content: '', tags: [] }),
    })
    if (res.ok) {
      const data = (await res.json()) as { id: string; note?: Note }
      if (data.note) {
        setNotes((prev) => [data.note!, ...prev])
        openNote(data.note)
        return
      }
      await loadNotes()
      openNote({
        _id: data.id,
        title: 'Untitled',
        content: '',
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }

  async function deleteNote(noteId: string, event: React.MouseEvent) {
    event.stopPropagation()
    await fetch(`/api/app/notes?noteId=${noteId}`, { method: 'DELETE' })
    if (activeNote?._id === noteId) {
      setActiveNote(null)
      setTitle('')
      editor?.commands.clearContent()
      if (!hideSidebar) {
        router.replace('/app/notes')
      }
    }
    setNotes((prev) => prev.filter((note) => note._id !== noteId))
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

  return (
    <div className="flex h-full flex-col">
      {/* Header - shows note title when active, otherwise "Notes" */}
      {activeNote ? (
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
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
          </div>
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

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeNote ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <EditorContent editor={editor} />
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

