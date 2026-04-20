'use client'
import { useState, useEffect } from 'react'

const KEY = 'overlay:wordLevelStreaming'

export function useWordLevelStreaming(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY)
      if (stored !== null) setValue(stored !== 'false')
    } catch {}
  }, [])

  function set(v: boolean) {
    setValue(v)
    try {
      localStorage.setItem(KEY, String(v))
    } catch {}
  }

  return [value, set]
}
