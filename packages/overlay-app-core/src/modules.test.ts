import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildProjectTree,
  buildTree,
  collectProjectDescendantIds,
  filterExtensionCatalog,
  noteEditorState,
  resolveSettingsSection,
} from './modules'

test('buildTree creates sorted nested nodes', () => {
  const tree = buildTree([
    { _id: 'b', name: 'B', parentId: null },
    { _id: 'a2', name: 'A child', parentId: 'a' },
    { _id: 'a', name: 'A', parentId: null },
  ])

  assert.deepEqual(tree.map((node) => node.item._id), ['a', 'b'])
  assert.deepEqual(tree[0]!.children.map((node) => node.item._id), ['a2'])
})

test('noteEditorState normalizes title and detects dirty drafts', () => {
  assert.deepEqual(
    noteEditorState({
      note: { title: 'Old', content: 'Body' },
      draftTitle: '  New  ',
      draftContent: 'Body',
    }),
    { title: 'New', isDirty: true, canSave: true },
  )
})

test('project helpers collect descendants', () => {
  const projects = [
    { _id: 'root', name: 'Root', parentId: null, createdAt: 1, updatedAt: 1 },
    { _id: 'child', name: 'Child', parentId: 'root', createdAt: 1, updatedAt: 1 },
    { _id: 'grand', name: 'Grand', parentId: 'child', createdAt: 1, updatedAt: 1 },
  ]
  assert.equal(buildProjectTree(projects).length, 1)
  assert.deepEqual(collectProjectDescendantIds(projects, 'root'), ['child', 'grand'])
})

test('extension catalog filter handles kind and query', () => {
  const items = [
    { kind: 'integration' as const, slug: 'gmail', name: 'Gmail', description: 'Mail', logoUrl: null, isConnected: true },
    { kind: 'skill' as const, _id: 's1', name: 'Reporter', description: 'Daily reports', instructions: '', enabled: true },
  ]
  assert.deepEqual(filterExtensionCatalog(items, { query: 'report' }).map((item) => item.kind), ['skill'])
  assert.deepEqual(filterExtensionCatalog(items, { kind: 'integration', enabledOnly: true }).map((item) => item.name), ['Gmail'])
})

test('resolveSettingsSection falls back to first registered section', () => {
  assert.equal(resolveSettingsSection('missing', [{ id: 'general' }, { id: 'models' }]), 'general')
  assert.equal(resolveSettingsSection('models', [{ id: 'general' }, { id: 'models' }]), 'models')
})
