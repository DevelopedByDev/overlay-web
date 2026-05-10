export interface WhiteLabelConfig {
  primary?: string
  radius?: string
  fontSans?: string
  logoUrl?: string
}

export function generateWhiteLabelCSS(config: WhiteLabelConfig): string {
  const lines: string[] = [':root {']
  if (config.primary) {
    lines.push(`  --foreground: ${config.primary};`)
  }
  if (config.radius) {
    lines.push(`  --overlay-radius: ${config.radius};`)
  }
  if (config.fontSans) {
    lines.push(`  --overlay-font-sans: ${config.fontSans};`)
  }
  lines.push('}')
  return lines.join('\n')
}
