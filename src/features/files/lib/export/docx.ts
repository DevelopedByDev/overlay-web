import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
} from 'docx'

interface ExportMessage {
  role: string
  content: string
}

export async function generateDocxFromMessages(
  title: string,
  messages: ExportMessage[],
): Promise<Blob> {
  const children: Paragraph[] = []

  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
  )

  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? 'User' : 'Assistant'
    children.push(
      new Paragraph({
        text: roleLabel,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      }),
    )

    const lines = msg.content.split('\n')
    for (const line of lines) {
      children.push(parseMarkdownLineToParagraph(line))
    }
  }

  const doc = new Document({
    sections: [{ children }],
  })

  return await Packer.toBlob(doc)
}

export async function generateDocxFromMarkdown(title: string, markdown: string): Promise<Blob> {
  const lines = markdown.split('\n')
  const children: Paragraph[] = []

  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
  )

  for (const line of lines) {
    children.push(parseMarkdownLineToParagraph(line))
  }

  const doc = new Document({
    sections: [{ children }],
  })

  return await Packer.toBlob(doc)
}

function parseMarkdownLineToParagraph(line: string): Paragraph {
  const trimmed = line.trim()

  if (!trimmed) {
    return new Paragraph({ text: '' })
  }

  if (trimmed.startsWith('# ')) {
    return new Paragraph({
      text: trimmed.slice(2),
      heading: HeadingLevel.HEADING_1,
    })
  }

  if (trimmed.startsWith('## ')) {
    return new Paragraph({
      text: trimmed.slice(3),
      heading: HeadingLevel.HEADING_2,
    })
  }

  if (trimmed.startsWith('### ')) {
    return new Paragraph({
      text: trimmed.slice(4),
      heading: HeadingLevel.HEADING_3,
    })
  }

  const runs: TextRun[] = []
  let remaining = trimmed

  remaining = parseInlineCode(remaining, runs)
  remaining = parseBold(remaining, runs)
  remaining = parseItalic(remaining, runs)

  if (remaining) {
    runs.push(new TextRun({ text: remaining }))
  }

  return new Paragraph({ children: runs })
}

function parseInlineCode(text: string, runs: TextRun[]): string {
  const regex = /`([^`]+)`/g
  let match
  let lastIndex = 0
  let result = ''

  while ((match = regex.exec(text)) !== null) {
    result += text.slice(lastIndex, match.index)
    runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }))
    runs.push(
      new TextRun({
        text: match[1],
        font: 'Courier New',
        shading: { fill: 'F3F4F6' },
      }),
    )
    lastIndex = regex.lastIndex
  }

  result += text.slice(lastIndex)
  return result
}

function parseBold(text: string, runs: TextRun[]): string {
  const regex = /\*\*([^*]+)\*\*/g
  let match
  let lastIndex = 0
  let result = ''

  while ((match = regex.exec(text)) !== null) {
    if (lastIndex < match.index) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }))
    }
    runs.push(new TextRun({ text: match[1], bold: true }))
    lastIndex = regex.lastIndex
  }

  result += text.slice(lastIndex)
  if (lastIndex === 0) result = text
  return result
}

function parseItalic(text: string, runs: TextRun[]): string {
  const regex = /\*([^*]+)\*/g
  let match
  let lastIndex = 0

  while ((match = regex.exec(text)) !== null) {
    if (lastIndex < match.index) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }))
    }
    runs.push(new TextRun({ text: match[1], italics: true }))
    lastIndex = regex.lastIndex
  }

  if (lastIndex === 0) return text
  return text.slice(lastIndex)
}
