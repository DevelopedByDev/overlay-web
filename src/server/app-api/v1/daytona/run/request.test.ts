import assert from 'node:assert/strict'
import test from 'node:test'
import {
  guessMimeType,
  parseDaytonaRunRequest,
  resolveExpectedOutputPath,
  sanitizeFileName,
  validateSandboxCommand,
} from './request'

test('parseDaytonaRunRequest preserves current validation error payloads', () => {
  assert.deepEqual(parseDaytonaRunRequest({}), {
    ok: false,
    error: { payload: { error: 'Task is required' }, status: 400, warning: undefined },
  })
  assert.deepEqual(parseDaytonaRunRequest({ task: 'build', runtime: 'ruby', command: 'echo ok', expectedOutputs: ['out.txt'] }), {
    ok: false,
    error: { payload: { error: 'runtime must be "node" or "python"' }, status: 400, warning: undefined },
  })
  assert.deepEqual(parseDaytonaRunRequest({ task: 'build', runtime: 'node', command: '', expectedOutputs: ['out.txt'] }), {
    ok: false,
    error: { payload: { error: 'command is required' }, status: 400, warning: undefined },
  })
  assert.deepEqual(parseDaytonaRunRequest({ task: 'build', runtime: 'node', command: 'echo ok', expectedOutputs: [] }), {
    ok: false,
    error: { payload: { error: 'expectedOutputs must include at least one path' }, status: 400, warning: undefined },
  })
})

test('parseDaytonaRunRequest normalizes valid request fields', () => {
  const parsed = parseDaytonaRunRequest({
    task: ' build artifact ',
    runtime: 'python',
    command: ' python main.py ',
    code: 'print(1)',
    inputFileIds: [' file_1 ', 2],
    expectedOutputs: ['out/report.txt'],
    conversationId: 'conversation_1',
    turnId: 'turn_1',
  })

  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.ok ? parsed.value : null, {
    task: 'build artifact',
    runtime: 'python',
    command: 'python main.py',
    code: 'print(1)',
    inputFileIds: [' file_1 ', '2'],
    expectedOutputs: ['out/report.txt'],
    conversationId: 'conversation_1',
    turnId: 'turn_1',
  })
})

test('validateSandboxCommand blocks internal endpoints with existing reason', () => {
  assert.deepEqual(validateSandboxCommand('curl http://169.254.169.254/latest/meta-data'), {
    ok: false,
    reason: 'Command references an internal or metadata endpoint.',
  })
})

test('resolveExpectedOutputPath preserves sandbox escape protection', () => {
  assert.equal(resolveExpectedOutputPath('/workspace', 'out/report.txt'), '/workspace/out/report.txt')
  assert.throws(
    () => resolveExpectedOutputPath('/workspace', '../secret.txt'),
    /Expected output path escapes the sandbox workspace: \.\.\/secret\.txt/,
  )
})

test('sanitizeFileName and guessMimeType preserve artifact DTO inputs', () => {
  assert.equal(sanitizeFileName('../Quarterly deck!.pptx', 'artifact-1'), 'Quarterly_deck_.pptx')
  assert.equal(sanitizeFileName('///', 'artifact-1'), 'artifact-1')
  assert.equal(guessMimeType('deck.pptx', Buffer.from('x')), 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  assert.equal(guessMimeType('unknown.bin', Buffer.from('hello')), 'text/plain; charset=utf-8')
  assert.equal(guessMimeType('unknown.bin', Buffer.from([0, 1, 2])), 'application/octet-stream')
})
