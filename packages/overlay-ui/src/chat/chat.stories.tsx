import type { Meta, StoryObj } from '@storybook/react'
import { ChatLayout, Composer, MessageBubble, MessageList, ModelSelector, ToolCallCard } from '../index'
import * as React from 'react'

const meta: Meta = {
  title: 'Overlay UI/Chat',
}

export default meta
type Story = StoryObj

function ConversationSurfaceDemo() {
  const [value, setValue] = React.useState('Summarize the rollout risks')
  return (
    <ChatLayout sidebar={<aside style={{ width: 220, borderRight: '1px solid var(--border)', padding: 16 }}>Projects</aside>}>
      <div style={{ height: 420, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12 }}>
          <ModelSelector
            value="sonnet"
            onChange={() => {}}
            models={[{ id: 'sonnet', name: 'Claude Sonnet' }, { id: 'auto', name: 'Auto' }]}
          />
        </div>
        <MessageList>
          <MessageBubble role="user" content="Find blockers in the enterprise deployment plan." />
          <MessageBubble role="assistant" content="The largest blockers are auth provider configuration and storage migration ownership." />
          <ToolCallCard toolName="search_knowledge" status="success">
            <pre>3 matching documents</pre>
          </ToolCallCard>
        </MessageList>
        <Composer value={value} onChange={setValue} onSubmit={() => {}} />
      </div>
    </ChatLayout>
  )
}

export const ConversationSurface: Story = {
  render: () => <ConversationSurfaceDemo />,
}
