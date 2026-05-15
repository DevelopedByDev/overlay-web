import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseSkillMarkdown,
  serializeSkillToMarkdown,
  skillFilenameFromName,
} from './skill-markdown.ts'

test('serializes and parses a skill round trip', () => {
  const source = {
    name: 'Daily Standup',
    description: 'Generate a concise standup summary from notes',
    instructions: [
      'When the user asks for standup help:',
      '',
      '- Pull yesterday notes',
      '- Summarize blockers',
    ].join('\n'),
    enabled: false,
  }

  const markdown = serializeSkillToMarkdown(source)
  const parsed = parseSkillMarkdown(markdown)

  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.deepEqual(parsed.skill, source)
})

test('parses unquoted frontmatter values', () => {
  const parsed = parseSkillMarkdown([
    '---',
    'name: Concise Responder',
    'description: Keep replies short',
    'enabled: true',
    '---',
    '',
    'Answer in three sentences or fewer.',
  ].join('\n'))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.skill.name, 'Concise Responder')
  assert.equal(parsed.skill.description, 'Keep replies short')
  assert.equal(parsed.skill.enabled, true)
})

test('derives description from the first body line when missing', () => {
  const parsed = parseSkillMarkdown([
    '---',
    'name: Notes',
    '---',
    '',
    '',
    'Summarize notes into action items.',
  ].join('\n'))

  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.skill.description, 'Summarize notes into action items.')
})

test('rejects content without frontmatter', () => {
  const parsed = parseSkillMarkdown('name: Missing\n\nBody')

  assert.equal(parsed.ok, false)
  if (parsed.ok) return
  assert.match(parsed.error, /frontmatter/i)
})

test('rejects missing required name', () => {
  const parsed = parseSkillMarkdown([
    '---',
    'description: Missing name',
    '---',
    '',
    'Body',
  ].join('\n'))

  assert.equal(parsed.ok, false)
  if (parsed.ok) return
  assert.match(parsed.error, /name/i)
})

test('rejects invalid enabled values', () => {
  const parsed = parseSkillMarkdown([
    '---',
    'name: Bad Enabled',
    'enabled: sometimes',
    '---',
    '',
    'Body',
  ].join('\n'))

  assert.equal(parsed.ok, false)
  if (parsed.ok) return
  assert.match(parsed.error, /enabled/i)
})

test('normalizes skill filenames', () => {
  assert.equal(skillFilenameFromName('Daily Standup!'), 'daily-standup.skill.md')
  assert.equal(skillFilenameFromName('  Q&A: Sales / Support  '), 'q-a-sales-support.skill.md')
  assert.equal(skillFilenameFromName('$$$'), 'skill.skill.md')
})
