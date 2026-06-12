import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACT_KNOWLEDGE_WEB_TOOLS_NOTE,
  ASK_KNOWLEDGE_TOOLS_NOTE,
  ASK_KNOWLEDGE_TOOLS_NOTE_NO_WEB,
  indexedFilesSystemNote,
} from './knowledge-agent-instructions'

test('knowledge notes prefer response-first TTFT guidance over mandatory search-first', () => {
  for (const note of [ASK_KNOWLEDGE_TOOLS_NOTE, ASK_KNOWLEDGE_TOOLS_NOTE_NO_WEB, ACT_KNOWLEDGE_WEB_TOOLS_NOTE]) {
    assert.match(note, /Response-first \(TTFT\)/)
    assert.doesNotMatch(note, /at the start of any task/i)
    assert.doesNotMatch(note, /Web tool decision rule \(HARD\)/)
  }
})

test('indexedFilesSystemNote avoids hard no-preamble rule for lexical ids', () => {
  const note = indexedFilesSystemNote([
    { name: 'report.pdf', fileIds: ['file_abc'] },
  ])
  assert.match(note, /AUTO_RETRIEVED_KNOWLEDGE/)
  assert.doesNotMatch(note, /No preamble \(HARD\)/)
})
