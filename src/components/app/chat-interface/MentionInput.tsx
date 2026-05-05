'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { MentionPopup } from './MentionPopup'
import { useMentionData } from './useMentionData'
import type { MentionCategory, MentionItem } from './mention-types'

export interface MentionInputHandle {
  focus: () => void
  clear: () => void
  getPlainText: () => string
  getMentions: () => MentionItem[]
  setPlainText: (text: string) => void
  getElement: () => HTMLDivElement | null
}

interface MentionInputProps {
  value: string
  onChange: (text: string) => void
  onMentionsChange: (mentions: MentionItem[]) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void
  onUploadFile: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const MENTION_ATTR = 'data-mention'
const MENTION_TYPE_ATTR = 'data-mention-type'
const MENTION_ID_ATTR = 'data-mention-id'

function createMentionChip(item: MentionItem): HTMLSpanElement {
  const chip = document.createElement('span')
  chip.contentEditable = 'false'
  chip.setAttribute(MENTION_ATTR, 'true')
  chip.setAttribute(MENTION_TYPE_ATTR, item.type)
  chip.setAttribute(MENTION_ID_ATTR, item.id)
  chip.className =
    'inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md bg-[var(--surface-muted)] border border-[var(--border)] text-xs font-medium text-[var(--foreground)] select-none align-baseline'
  chip.textContent = `@${item.name}`
  // Store full item data
  chip.dataset.mentionData = JSON.stringify(item)
  return chip
}

function extractMentionsFromElement(el: HTMLDivElement): MentionItem[] {
  const chips = el.querySelectorAll(`[${MENTION_ATTR}]`)
  const mentions: MentionItem[] = []
  chips.forEach((chip) => {
    try {
      const data = (chip as HTMLElement).dataset.mentionData
      if (data) mentions.push(JSON.parse(data))
    } catch {
      // skip malformed
    }
  })
  return mentions
}

function extractPlainTextFromElement(el: HTMLDivElement): string {
  let text = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      if (element.getAttribute(MENTION_ATTR)) {
        text += element.textContent || ''
      } else if (element.tagName === 'BR') {
        text += '\n'
      } else if (element.tagName === 'DIV' || element.tagName === 'P') {
        if (text.length > 0 && !text.endsWith('\n')) text += '\n'
        element.childNodes.forEach(walk)
        return
      } else {
        element.childNodes.forEach(walk)
        return
      }
    }
  }
  el.childNodes.forEach(walk)
  return text
}

function getCaretCoords(): { x: number; y: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0).cloneRange()
  range.collapse(true)
  const rect = range.getBoundingClientRect()
  // If rect is 0,0 (e.g. empty line), use parent element rect
  if (rect.x === 0 && rect.y === 0) {
    const parent = range.startContainer.parentElement
    if (parent) {
      const parentRect = parent.getBoundingClientRect()
      return { x: parentRect.x, y: parentRect.y }
    }
    return null
  }
  return { x: rect.x, y: rect.y }
}

function getMentionQueryFromCaret(el: HTMLDivElement): { query: string; triggerOffset: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!el.contains(range.startContainer)) return null

  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return null

  const text = node.textContent || ''
  const offset = range.startOffset
  const textBefore = text.slice(0, offset)

  // Find the last @ that is either at position 0 or preceded by whitespace
  const atIdx = textBefore.lastIndexOf('@')
  if (atIdx === -1) return null
  if (atIdx > 0 && textBefore[atIdx - 1] !== ' ' && textBefore[atIdx - 1] !== '\n') return null

  const query = textBefore.slice(atIdx + 1)
  // If there's a space in the query, the mention is likely done
  if (query.includes(' ') && query.length > 20) return null

  return { query, triggerOffset: atIdx }
}

function removeMentionQueryText(el: HTMLDivElement, triggerOffset: number) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return

  const text = node.textContent || ''
  const offset = range.startOffset
  // Remove from @ to current cursor position
  node.textContent = text.slice(0, triggerOffset) + text.slice(offset)
  // Place cursor after the position where we'll insert the chip
  const newRange = document.createRange()
  newRange.setStart(node, triggerOffset)
  newRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(newRange)
}

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  function MentionInput(
    {
      value,
      onChange,
      onMentionsChange,
      onKeyDown,
      onPaste,
      onUploadFile,
      placeholder,
      className,
      disabled,
    },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null)
    const [showPopup, setShowPopup] = useState(false)
    const [mentionQuery, setMentionQuery] = useState('')
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)
    const [categories, setCategories] = useState<MentionCategory[]>([])
    const triggerOffsetRef = useRef<number>(0)
    const isComposingRef = useRef(false)
    const suppressInputRef = useRef(false)
    const lastValueRef = useRef(value)

    const { search, loading } = useMentionData()

    // Sync external value changes into the editor (only when value is cleared externally, e.g. on send)
    useEffect(() => {
      const el = editorRef.current
      if (!el) return
      if (value === '' && lastValueRef.current !== '') {
        el.innerHTML = ''
      }
      lastValueRef.current = value
    }, [value])

    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus(),
      clear: () => {
        if (editorRef.current) {
          editorRef.current.innerHTML = ''
          onChange('')
          onMentionsChange([])
        }
      },
      getPlainText: () => {
        if (!editorRef.current) return ''
        return extractPlainTextFromElement(editorRef.current)
      },
      getMentions: () => {
        if (!editorRef.current) return []
        return extractMentionsFromElement(editorRef.current)
      },
      setPlainText: (text: string) => {
        if (editorRef.current) {
          editorRef.current.textContent = text
          onChange(text)
        }
      },
      getElement: () => editorRef.current,
    }))

    const handleInput = useCallback(() => {
      if (suppressInputRef.current) return
      const el = editorRef.current
      if (!el) return

      const text = extractPlainTextFromElement(el)
      lastValueRef.current = text
      onChange(text)
      onMentionsChange(extractMentionsFromElement(el))

      // Check for @ trigger
      if (!isComposingRef.current) {
        const mentionState = getMentionQueryFromCaret(el)
        if (mentionState) {
          setMentionQuery(mentionState.query)
          triggerOffsetRef.current = mentionState.triggerOffset
          const coords = getCaretCoords()
          if (coords) {
            setPopupPosition(coords)
            setShowPopup(true)
            void search(mentionState.query).then(setCategories)
          }
        } else {
          setShowPopup(false)
        }
      }
    }, [onChange, onMentionsChange, search])

    // Search when mentionQuery changes
    useEffect(() => {
      if (!showPopup) return
      void search(mentionQuery).then(setCategories)
    }, [mentionQuery, showPopup, search])

    const handleSelect = useCallback(
      (item: MentionItem) => {
        const el = editorRef.current
        if (!el) return

        // Remove the @query text
        removeMentionQueryText(el, triggerOffsetRef.current)

        // Insert mention chip
        const chip = createMentionChip(item)
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          range.insertNode(chip)
          // Move cursor after chip
          range.setStartAfter(chip)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
          // Insert a space after the chip
          const space = document.createTextNode('\u00A0')
          range.insertNode(space)
          range.setStartAfter(space)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }

        setShowPopup(false)
        setMentionQuery('')

        // Update state
        const text = extractPlainTextFromElement(el)
        lastValueRef.current = text
        onChange(text)
        onMentionsChange(extractMentionsFromElement(el))
      },
      [onChange, onMentionsChange]
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        // If popup is open, don't propagate Enter/Arrow keys
        if (showPopup && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape')) {
          // Let MentionPopup handle these via document listener
          return
        }

        // Handle backspace on mention chip
        if (e.key === 'Backspace') {
          const sel = window.getSelection()
          if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
            const range = sel.getRangeAt(0)
            const node = range.startContainer
            if (node.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
              const prev = node.previousSibling as HTMLElement | null
              if (prev?.getAttribute?.(MENTION_ATTR)) {
                e.preventDefault()
                prev.remove()
                handleInput()
                return
              }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement
              const childBefore = el.childNodes[range.startOffset - 1] as HTMLElement | undefined
              if (childBefore?.getAttribute?.(MENTION_ATTR)) {
                e.preventDefault()
                childBefore.remove()
                handleInput()
                return
              }
            }
          }
        }

        onKeyDown?.(e)
      },
      [showPopup, onKeyDown, handleInput]
    )

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLDivElement>) => {
        // Check for images first — delegate to parent
        const hasImages = Array.from(e.clipboardData.items).some((item) =>
          item.type.startsWith('image/')
        )
        if (hasImages) {
          onPaste?.(e)
          return
        }

        // For text paste, insert as plain text
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        if (text) {
          document.execCommand('insertText', false, text)
        }
      },
      [onPaste]
    )

    const closePopup = useCallback(() => {
      setShowPopup(false)
      setMentionQuery('')
    }, [])

    // Auto-resize
    useEffect(() => {
      const el = editorRef.current
      if (!el) return
      const maxHeight = 160
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
    }, [value])

    return (
      <div className="relative w-full">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => { isComposingRef.current = true }}
          onCompositionEnd={() => {
            isComposingRef.current = false
            handleInput()
          }}
          data-placeholder={placeholder}
          className={`w-full min-h-11 resize-none border-0 bg-transparent px-0.5 py-1 text-sm leading-6 text-[var(--foreground)] shadow-none outline-none ring-0 placeholder:text-[var(--muted-light)] focus:ring-0 empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--muted-light)] empty:before:pointer-events-none ${className || ''}`}
          role="textbox"
          aria-multiline="true"
          aria-placeholder={placeholder}
        />
        {showPopup && (
          <MentionPopup
            categories={categories}
            loading={loading}
            position={popupPosition}
            onSelect={handleSelect}
            onUploadFile={() => {
              closePopup()
              onUploadFile()
            }}
            onClose={closePopup}
            query={mentionQuery}
          />
        )}
      </div>
    )
  }
)
