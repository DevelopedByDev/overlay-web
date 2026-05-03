export async function generatePdfFromHtml(title: string, html: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const html2canvas = (await import('html2canvas')).default

  const container = document.createElement('div')
  container.innerHTML = `
    <div style="font-family: system-ui, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; color: #1a1a1a;">
      <h1 style="font-size: 22px; margin-bottom: 24px; font-weight: 600;">${escapeHtml(title)}</h1>
      <div style="line-height: 1.6; font-size: 14px;">${html}</div>
    </div>
  `
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '-9999px'
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    })

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
    return pdf.output('blob')
  } finally {
    document.body.removeChild(container)
  }
}

export async function generatePdfFromMarkdown(title: string, markdown: string): Promise<Blob> {
  const { htmlToMarkdown } = await import('./markdown')
  const plainHtml = markdown
    .replace(/^#+\s/gm, (m) => `<h${m.match(/#/g)?.length || 1}>${m.replace(/#/g, '').trim()}</h${m.match(/#/g)?.length || 1}>`)
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\n/gm, '<br/>')

  const wrappedHtml = `<div style="line-height: 1.6;">${plainHtml.replace(/\n/g, '<br/>')}</div>`
  return generatePdfFromHtml(title, wrappedHtml)
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
