/**
 * OpenUI Lang component library definition for Overlay.
 *
 * Defines the components the LLM can use and generates the system prompt
 * fragment that teaches it to output OpenUI Lang.
 *
 * NO npm package required — this is a pure description used to build the
 * system prompt. Rendering happens in OpenUIRenderer.tsx.
 */

export const OPENUI_COMPONENTS = [
  {
    name: 'Stack',
    description: 'Vertical flex container for grouping components.',
    args: [{ name: 'children', type: 'array of refs', description: 'Components to stack vertically' }],
    example: 'Stack([header, body])',
  },
  {
    name: 'Grid',
    description: 'Horizontal grid of equal-width columns.',
    args: [{ name: 'children', type: 'array of refs', description: 'Components arranged in a grid' }],
    example: 'Grid([c1, c2, c3])',
  },
  {
    name: 'Card',
    description: 'Bordered card with a headline and optional body text.',
    args: [
      { name: 'headline', type: 'string', description: 'Card title' },
      { name: 'body', type: 'string', description: 'Body text (optional)' },
    ],
    example: 'Card("Revenue Summary", "Q4 results were strong.")',
  },
  {
    name: 'StatCard',
    description: 'Metric display card with label, value, and optional trend indicator.',
    args: [
      { name: 'label', type: 'string', description: 'Metric name' },
      { name: 'value', type: 'string', description: 'Metric value (e.g. "$1.2M", "94%")' },
      { name: 'trend', type: 'string', description: 'Trend: "up", "down", or "flat" (optional)' },
    ],
    example: 'StatCard("Revenue", "$1.2M", "up")',
  },
  {
    name: 'DataTable',
    description: 'A two-dimensional data table. Columns are comma-separated in a string. Rows are DataRow refs.',
    args: [
      { name: 'columns', type: 'string', description: 'Comma-separated column headers (e.g. "Name,Value,Status")' },
      { name: 'rows', type: 'array of DataRow refs', description: 'Array of DataRow components' },
    ],
    example: 'DataTable("Name,Score,Grade", [r1, r2, r3])',
  },
  {
    name: 'DataRow',
    description: 'A single row inside a DataTable. Values are comma-separated in a string.',
    args: [
      { name: 'values', type: 'string', description: 'Comma-separated cell values matching the table columns' },
    ],
    example: 'DataRow("Alice,98,A+")',
  },
  {
    name: 'Badge',
    description: 'A small inline label badge.',
    args: [
      { name: 'label', type: 'string', description: 'Badge text' },
      { name: 'variant', type: 'string', description: 'Visual style: "default", "success", "warning", "error", "info" (optional, defaults to "default")' },
    ],
    example: 'Badge("Active", "success")',
  },
  {
    name: 'Alert',
    description: 'An inline alert or callout block.',
    args: [
      { name: 'type', type: 'string', description: 'Alert type: "info", "success", "warning", "error"' },
      { name: 'message', type: 'string', description: 'Alert body text' },
      { name: 'title', type: 'string', description: 'Optional alert title' },
    ],
    example: 'Alert("warning", "Disk usage is above 90%", "Storage Warning")',
  },
  {
    name: 'KeyValueList',
    description: 'A vertical list of label-value pairs. Each pair is a KeyValuePair ref.',
    args: [
      { name: 'pairs', type: 'array of KeyValuePair refs', description: 'Array of KeyValuePair components' },
    ],
    example: 'KeyValueList([p1, p2, p3])',
  },
  {
    name: 'KeyValuePair',
    description: 'A single label-value pair used inside KeyValueList.',
    args: [
      { name: 'label', type: 'string', description: 'Key/label text' },
      { name: 'value', type: 'string', description: 'Value text' },
    ],
    example: 'KeyValuePair("Status", "Running")',
  },
  {
    name: 'TextContent',
    description: 'A text block with optional semantic style.',
    args: [
      { name: 'text', type: 'string', description: 'The text to display' },
      { name: 'style', type: 'string', description: 'Optional style: "heading", "subheading", "muted", "normal" (default)' },
    ],
    example: 'TextContent("System Overview", "heading")',
  },
  {
    name: 'Section',
    description: 'A named section with a title and child components.',
    args: [
      { name: 'title', type: 'string', description: 'Section heading text' },
      { name: 'children', type: 'array of refs', description: 'Components inside the section' },
    ],
    example: 'Section("Performance", [chart, summary])',
  },
] as const

/**
 * Generates the system prompt fragment that teaches the model to output OpenUI Lang
 * when a response would benefit from structured UI.
 */
export function buildOpenUISystemPrompt(): string {
  const componentDocs = OPENUI_COMPONENTS.map((c) => {
    const argList = c.args.map((a) => `  - ${a.name} (${a.type}): ${a.description}`).join('\n')
    return `${c.name}(${c.args.map((a) => a.name).join(', ')})\n  ${c.description}\n${argList}\n  Example: \`${c.example}\``
  }).join('\n\n')

  return `## Generative UI (Experimental)

When a response would benefit from structured visual presentation — such as metrics, comparisons, tables, key-value data, or status summaries — you MAY render it as a UI block using OpenUI Lang instead of plain markdown.

### When to use generative UI
Use it for: dashboards, metric summaries, comparison tables, structured data, status overviews, key-value lists.
Do NOT use it for: conversational text, explanations, code, long-form writing, or content that flows naturally as markdown.

### How to output a UI block
Wrap the OpenUI Lang inside a fenced code block with language \`openui\`:

\`\`\`openui
root = Stack([title, stats])
title = TextContent("Q4 Summary", "heading")
stats = Grid([s1, s2])
s1 = StatCard("Revenue", "$1.2M", "up")
s2 = StatCard("Users", "45k", "flat")
\`\`\`

### OpenUI Lang rules
1. One statement per line: \`identifier = ComponentName(args)\`
2. The FIRST statement MUST assign to \`root\`
3. Arguments map to component props in order (positional)
4. Strings use double quotes. Arrays use \`[ref1, ref2]\` syntax
5. Define referenced identifiers AFTER the root, top-to-bottom
6. Keep it minimal — 3-12 lines is ideal

### Available components
${componentDocs}

### Composing UI
You can mix UI blocks with surrounding markdown text. Put the \`\`\`openui block where the visual summary belongs, and use regular markdown for the surrounding explanation.

Only generate UI when it clearly improves the response. When in doubt, use markdown.`
}
