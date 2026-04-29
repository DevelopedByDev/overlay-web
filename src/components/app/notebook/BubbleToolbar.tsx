'use client'

import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { ImproveButton, linkAction, markActions, ToolbarButton } from './toolbarButtons'

export default function BubbleToolbar({
  editor,
  onImprove,
}: {
  editor: Editor | null
  onImprove: () => void
}) {
  if (!editor) return null
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="selectionBubbleMenu"
      shouldShow={({ editor: currentEditor }: { editor: Editor }) => !currentEditor.state.selection.empty}
      options={{ placement: 'top', offset: 8 }}
    >
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-1 shadow-lg">
        <ImproveButton onClick={onImprove} />
        <div className="mx-1 h-5 w-px bg-[var(--border)]" />
        {markActions.map((action) => <ToolbarButton key={action.id} editor={editor} action={action} />)}
        <ToolbarButton editor={editor} action={linkAction} />
      </div>
    </BubbleMenu>
  )
}
