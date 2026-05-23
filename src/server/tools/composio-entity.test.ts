import assert from 'node:assert/strict'
import test from 'node:test'

test('projectComposioEntityId includes user and project scope', async () => {
  const { projectComposioEntityId } = await import(
    new URL('./composio-entity.ts', import.meta.url).href
  )
  assert.equal(
    projectComposioEntityId('user_123', 'project_456'),
    'overlay_project_user_123_project_456',
  )
})

test('projectComposioEntityId normalizes unsupported characters', async () => {
  const { projectComposioEntityId } = await import(
    new URL('./composio-entity.ts', import.meta.url).href
  )
  assert.equal(
    projectComposioEntityId('user:abc@example.com', 'proj/123'),
    'overlay_project_user_abc_example_com_proj_123',
  )
})
