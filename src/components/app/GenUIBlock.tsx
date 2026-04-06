'use client'
import { Renderer } from '@openuidev/react-lang'
import { uiLibrary } from '@/lib/openui-library'
import '@openuidev/react-ui/components.css'

interface GenUIBlockProps {
  uiCode: string
  isStreaming: boolean
}

export function GenUIBlock({ uiCode, isStreaming }: GenUIBlockProps) {
  return (
    <div className="w-full px-1 py-2">
      <Renderer response={uiCode} library={uiLibrary} isStreaming={isStreaming} />
    </div>
  )
}
