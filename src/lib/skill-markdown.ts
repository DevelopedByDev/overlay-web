export interface MarkdownSkill {
  name: string
  description: string
  instructions: string
  enabled?: boolean
}

export type ParsedSkill = MarkdownSkill

type ParseResult =
  | { ok: true; skill: ParsedSkill }
  | { ok: false; error: string }

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function parseYamlString(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    if (trimmed.startsWith('"')) {
      return JSON.parse(trimmed) as string
    }
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }
  return trimmed
}

function parseEnabled(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return undefined
}

function parseFrontmatter(frontmatter: string): Record<string, string> {
  const fields: Record<string, string> = {}

  for (const rawLine of frontmatter.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf(':')
    if (separator <= 0) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key === 'name' || key === 'description' || key === 'enabled') {
      fields[key] = value
    }
  }

  return fields
}

function descriptionFromInstructions(instructions: string): string {
  const firstLine = instructions
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) return 'Imported skill'
  return firstLine.length > 120 ? `${firstLine.slice(0, 117).trim()}...` : firstLine
}

export function serializeSkillToMarkdown(skill: MarkdownSkill): string {
  const lines = [
    '---',
    `name: ${yamlString(skill.name)}`,
    `description: ${yamlString(skill.description)}`,
  ]

  if (skill.enabled !== undefined) {
    lines.push(`enabled: ${skill.enabled ? 'true' : 'false'}`)
  }

  lines.push('---', '', skill.instructions.trim())
  return `${lines.join('\n')}\n`
}

export function parseSkillMarkdown(content: string): ParseResult {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return { ok: false, error: 'Missing YAML frontmatter' }
  }

  const closingIndex = normalized.indexOf('\n---', 4)
  if (closingIndex === -1) {
    return { ok: false, error: 'Invalid YAML frontmatter' }
  }

  const afterClosing = normalized.slice(closingIndex + 4)
  if (afterClosing.length > 0 && !afterClosing.startsWith('\n')) {
    return { ok: false, error: 'Invalid YAML frontmatter' }
  }

  let fields: Record<string, string>
  try {
    fields = parseFrontmatter(normalized.slice(4, closingIndex))
  } catch {
    return { ok: false, error: 'Invalid YAML frontmatter' }
  }

  let name = ''
  let description = ''
  try {
    name = fields.name ? parseYamlString(fields.name).trim() : ''
    description = fields.description ? parseYamlString(fields.description).trim() : ''
  } catch {
    return { ok: false, error: 'Invalid YAML frontmatter' }
  }

  const instructions = afterClosing.replace(/^\n+/, '').trim()
  if (!name) {
    return { ok: false, error: 'Missing required field: name' }
  }
  if (!instructions) {
    return { ok: false, error: 'Missing instructions body' }
  }

  const enabled = fields.enabled === undefined ? undefined : parseEnabled(fields.enabled)
  if (fields.enabled !== undefined && enabled === undefined) {
    return { ok: false, error: 'enabled must be true or false' }
  }

  return {
    ok: true,
    skill: {
      name,
      description: description || descriptionFromInstructions(instructions),
      instructions,
      ...(enabled !== undefined ? { enabled } : {}),
    },
  }
}

export function skillFilenameFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slug || 'skill'}.skill.md`
}
