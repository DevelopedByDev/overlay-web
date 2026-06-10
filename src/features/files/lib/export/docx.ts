interface ExportMessage {
  role: string
  content: string
}

type DocxModule = typeof import('docx')
type DocxParagraph = InstanceType<DocxModule['Paragraph']>
type DocxTextRun = InstanceType<DocxModule['TextRun']>

export async function generateDocxFromMessages(
  title: string,
  messages: ExportMessage[],
): Promise<Blob> {
  const docx = await import('docx')
  const children: DocxParagraph[] = []

  children.push(
    new docx.Paragraph({
      text: title,
      heading: docx.HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
  )

  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? 'User' : 'Assistant'
    children.push(
      new docx.Paragraph({
        text: roleLabel,
        heading: docx.HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      }),
    )

    const lines = msg.content.split('\n')
    for (const line of lines) {
      children.push(parseMarkdownLineToParagraph(line, docx))
    }
  }

  const doc = new docx.Document({
    sections: [{ children }],
  })

  return await docx.Packer.toBlob(doc)
}

export async function generateDocxFromMarkdown(title: string, markdown: string): Promise<Blob> {
  const docx = await import('docx')
  const lines = markdown.split('\n')
  const children: DocxParagraph[] = []

  children.push(
    new docx.Paragraph({
      text: title,
      heading: docx.HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
  )

  for (const line of lines) {
    children.push(parseMarkdownLineToParagraph(line, docx))
  }

  const doc = new docx.Document({
    sections: [{ children }],
  })

  return await docx.Packer.toBlob(doc)
}

function parseMarkdownLineToParagraph(line: string, docx: DocxModule): DocxParagraph {
  const trimmed = line.trim()

  if (!trimmed) {
    return new docx.Paragraph({ text: '' })
  }

  if (trimmed.startsWith('# ')) {
    return new docx.Paragraph({
      text: trimmed.slice(2),
      heading: docx.HeadingLevel.HEADING_1,
    })
  }

  if (trimmed.startsWith('## ')) {
    return new docx.Paragraph({
      text: trimmed.slice(3),
      heading: docx.HeadingLevel.HEADING_2,
    })
  }

  if (trimmed.startsWith('### ')) {
    return new docx.Paragraph({
      text: trimmed.slice(4),
      heading: docx.HeadingLevel.HEADING_3,
    })
  }

  const runs: DocxTextRun[] = []
  let remaining = trimmed

  remaining = parseInlineCode(remaining, runs, docx)
  remaining = parseBold(remaining, runs, docx)
  remaining = parseItalic(remaining, runs, docx)

  if (remaining) {
    runs.push(new docx.TextRun({ text: remaining }))
  }

  return new docx.Paragraph({ children: runs })
}

function parseInlineCode(text: string, runs: DocxTextRun[], docx: DocxModule): string {
  const regex = /`([^`]+)`/g
  let match
  let lastIndex = 0
  let result = ''

  while ((match = regex.exec(text)) !== null) {
    result += text.slice(lastIndex, match.index)
    runs.push(new docx.TextRun({ text: text.slice(lastIndex, match.index) }))
    runs.push(
      new docx.TextRun({
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

function parseBold(text: string, runs: DocxTextRun[], docx: DocxModule): string {
  const regex = /\*\*([^*]+)\*\*/g
  let match
  let lastIndex = 0
  let result = ''

  while ((match = regex.exec(text)) !== null) {
    if (lastIndex < match.index) {
      runs.push(new docx.TextRun({ text: text.slice(lastIndex, match.index) }))
    }
    runs.push(new docx.TextRun({ text: match[1], bold: true }))
    lastIndex = regex.lastIndex
  }

  result += text.slice(lastIndex)
  if (lastIndex === 0) result = text
  return result
}

function parseItalic(text: string, runs: DocxTextRun[], docx: DocxModule): string {
  const regex = /\*([^*]+)\*/g
  let match
  let lastIndex = 0

  while ((match = regex.exec(text)) !== null) {
    if (lastIndex < match.index) {
      runs.push(new docx.TextRun({ text: text.slice(lastIndex, match.index) }))
    }
    runs.push(new docx.TextRun({ text: match[1], italics: true }))
    lastIndex = regex.lastIndex
  }

  if (lastIndex === 0) return text
  return text.slice(lastIndex)
}
