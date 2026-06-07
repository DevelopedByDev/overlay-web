'use client'

import { ExchangeBlock } from '@overlay/chat-react/exchange-block'
import type { ComponentProps } from 'react'

type ChatToolSurfaceProps = ComponentProps<typeof ExchangeBlock>

export function ChatToolSurface(props: ChatToolSurfaceProps) {
  return <ExchangeBlock {...props} />
}
