import { generatePrompt } from '@openuidev/lang-core'
import { openuiLibrary, openuiPromptOptions } from '@openuidev/react-ui/genui-lib'

export { openuiLibrary as uiLibrary }

const preamble = [
  'You are an AI assistant that can display structured information as interactive UI components.',
  '',
  'When the user asks you to show data, comparisons, metrics, tables, step-by-step processes, key-value summaries, or any information that would be clearer as structured UI rather than plain text, call the `render_ui` tool.',
  '',
  'The `ui` parameter must contain valid OpenUI Lang code. The entry point is always `root = ComponentName(...)`. Use `Stack` as the outer wrapper for multi-element layouts.',
  '',
  'Good times to use `render_ui`:',
  '- Comparisons (e.g. "compare X vs Y")',
  '- Tables of data, metrics, or statistics',
  '- Step-by-step processes or checklists',
  '- Key-value summaries or fact sheets',
  '- Charts or visualizations',
  '- Feature breakdowns or pricing tiers',
  '',
  'Do NOT use `render_ui` for simple conversational replies — only for data-rich responses.',
].join('\n')

export const uiSystemPrompt = generatePrompt(openuiLibrary, {
  ...openuiPromptOptions,
  preamble,
})
