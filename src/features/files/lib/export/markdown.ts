export function htmlToMarkdown(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html

  let markdown = ''

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const children = Array.from(el.childNodes).map(walk).join('')

    switch (tag) {
      case 'h1':
        return `\n# ${children}\n`
      case 'h2':
        return `\n## ${children}\n`
      case 'h3':
        return `\n### ${children}\n`
      case 'p':
        return `\n${children}\n`
      case 'br':
        return '\n'
      case 'strong':
      case 'b':
        return `**${children}**`
      case 'em':
      case 'i':
        return `*${children}*`
      case 's':
      case 'strike':
      case 'del':
        return `~~${children}~~`
      case 'code':
        return `\`${children}\``
      case 'pre': {
        const code = el.querySelector('code')
        const lang = code?.getAttribute('class')?.replace('language-', '') || ''
        return `\n\`\`\`${lang}\n${children.replace(/`/g, '\\`')}\n\`\`\`\n`
      }
      case 'a': {
        const href = el.getAttribute('href') || ''
        return `[${children}](${href})`
      }
      case 'img': {
        const src = el.getAttribute('src') || ''
        const alt = el.getAttribute('alt') || ''
        return `![${alt}](${src})`
      }
      case 'ul': {
        const items = Array.from(el.children)
          .map((li) => `- ${walk(li).trim()}`)
          .join('\n')
        return `\n${items}\n`
      }
      case 'ol': {
        const items = Array.from(el.children)
          .map((li, i) => `${i + 1}. ${walk(li).trim()}`)
          .join('\n')
        return `\n${items}\n`
      }
      case 'li':
        return children
      case 'blockquote':
        return `\n${children.split('\n').filter(Boolean).map((l) => `> ${l}`).join('\n')}\n`
      case 'hr':
        return '\n---\n'
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr'))
        if (rows.length === 0) return ''
        const header = rows[0]
        const headerCells = Array.from(header.querySelectorAll('th, td')).map((c) => walk(c).trim())
        const separator = headerCells.map(() => '---').join(' | ')
        const body = rows
          .slice(1)
          .map((r) => Array.from(r.querySelectorAll('td')).map((c) => walk(c).trim()).join(' | '))
          .join('\n')
        return `\n| ${headerCells.join(' | ')} |\n| ${separator} |\n${body ? `| ${body.replace(/\n/g, ' |\n| ')} |\n` : ''}`
      }
      case 'th':
      case 'td':
        return children
      case 'div':
        return children
      case 'span':
        return children
      default:
        return children
    }
  }

  markdown = Array.from(div.childNodes).map(walk).join('')
  return markdown.replace(/\n{3,}/g, '\n\n').trim()
}

export function chatMessagesToMarkdown(
  messages: Array<{ role: string; content: string; parts?: Array<{ type: string; text?: string }> }>,
): string {
  return messages
    .map((msg) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant'
      let content = msg.content

      if (!content && msg.parts) {
        content = msg.parts.filter((p) => p.type === 'text').map((p) => p.text).join('')
      }

      return `### ${role}\n\n${content}\n`
    })
    .join('\n---\n\n')
}
