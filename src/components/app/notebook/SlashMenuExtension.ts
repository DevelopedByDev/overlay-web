import { Extension } from '@tiptap/core'

// Placeholder extension module for the notebook split. The existing SlashMenu UI
// still renders from NotebookEditor while this module gives the Suggestion-based
// trigger a stable home for the next editor iteration.
export const SlashMenuExtension = Extension.create({
  name: 'slashMenuExtension',
})
