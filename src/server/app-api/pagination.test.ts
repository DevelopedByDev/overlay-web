import assert from 'node:assert/strict'
import test from 'node:test'
import { paginateArray } from './pagination-core'

const rows = [
  { _id: 'a', name: 'Alpha', createdAt: 10, updatedAt: 30 },
  { _id: 'b', name: 'Beta', createdAt: 20, updatedAt: 20 },
  { _id: 'c', name: 'Gamma', createdAt: 30, updatedAt: 10 },
]

test('paginateArray returns the standard envelope and cursor pages', () => {
  const first = paginateArray(rows, new URLSearchParams({ limit: '2' }))
  assert.deepEqual(first.data.map((item) => item._id), ['a', 'b'])
  assert.equal(first.hasMore, true)
  assert.equal(first.total, 3)
  assert.equal(typeof first.nextCursor, 'string')

  const second = paginateArray(rows, new URLSearchParams({ limit: '2', cursor: first.nextCursor! }))
  assert.deepEqual(second.data.map((item) => item._id), ['c'])
  assert.equal(second.hasMore, false)
})

test('paginateArray supports name sorting and ascending order', () => {
  const page = paginateArray(rows, new URLSearchParams({ limit: '3', sort: 'name', order: 'asc' }))
  assert.deepEqual(page.data.map((item) => item._id), ['a', 'b', 'c'])
})
