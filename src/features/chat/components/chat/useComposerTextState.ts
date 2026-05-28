'use client'

import { useCallback, useRef, useState } from 'react'

export function useComposerTextState() {
  const [input, setInputState] = useState('')
  const [inputRevision, setInputRevision] = useState(0)
  const [hasComposerText, setHasComposerText] = useState(false)
  const inputRef = useRef(input)

  const setInput = useCallback((next: string | ((previous: string) => string)) => {
    const resolved = typeof next === 'function' ? next(inputRef.current) : next
    inputRef.current = resolved
    setInputState(resolved)
    setHasComposerText(resolved.trim().length > 0)
    setInputRevision((value) => value + 1)
  }, [])

  const handleComposerInputChange = useCallback((text: string) => {
    inputRef.current = text
    const hasText = text.trim().length > 0
    setHasComposerText((previous) => (previous === hasText ? previous : hasText))
  }, [])

  return {
    handleComposerInputChange,
    hasComposerText,
    input,
    inputRef,
    inputRevision,
    setInput,
  }
}
