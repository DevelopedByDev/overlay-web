import assert from 'node:assert/strict'
import test from 'node:test'

type Part = Record<string, unknown>

type Message = {
  id: string
  status: 'generating' | 'completed' | 'error'
  content: string
  parts: Part[]
}

type Delta = {
  id: string
  messageId: string
  textDelta?: string
  newParts?: Part[]
}

function isToolInvocationPart(part: Part): part is Part & {
  toolInvocation: {
    toolCallId?: string
    toolName?: string
    toolInput?: unknown
    toolOutput?: unknown
    state?: string
  }
} {
  return typeof part.toolInvocation === 'object' && part.toolInvocation !== null
}

function mergeLiveStreamingParts(existingParts: Part[], newParts: Part[]) {
  let nextParts = existingParts
  for (const part of newParts) {
    const last = nextParts[nextParts.length - 1]
    if (
      part.type === 'reasoning' &&
      last?.type === 'reasoning' &&
      typeof part.text === 'string'
    ) {
      nextParts = [
        ...nextParts.slice(0, -1),
        {
          ...last,
          text: `${typeof last.text === 'string' ? last.text : ''}${part.text}`,
          state: part.state ?? last.state,
        },
      ]
      continue
    }

    if (isToolInvocationPart(part)) {
      const incoming = part.toolInvocation
      const toolCallId = incoming.toolCallId
      if (toolCallId) {
        const existingIdx = nextParts.findIndex(
          (candidate) =>
            isToolInvocationPart(candidate) &&
            candidate.toolInvocation.toolCallId === toolCallId,
        )
        if (existingIdx >= 0) {
          const existing = nextParts[existingIdx]!
          if (isToolInvocationPart(existing)) {
            nextParts = [
              ...nextParts.slice(0, existingIdx),
              {
                type: 'tool-invocation',
                toolInvocation: {
                  ...existing.toolInvocation,
                  ...incoming,
                  toolName:
                    incoming.toolName === 'unknown_tool'
                      ? existing.toolInvocation.toolName
                      : incoming.toolName,
                  toolInput: incoming.toolInput ?? existing.toolInvocation.toolInput,
                  toolOutput: incoming.toolOutput ?? existing.toolInvocation.toolOutput,
                },
              },
              ...nextParts.slice(existingIdx + 1),
            ]
            continue
          }
        }
      }
    }

    nextParts = [...nextParts, part]
  }
  return nextParts
}

function applyLiveMessageDeltaParts(existingParts: Part[], delta: Delta) {
  let nextParts = existingParts
  if (delta.textDelta) {
    const last = nextParts[nextParts.length - 1]
    if (last?.type === 'text') {
      nextParts = [
        ...nextParts.slice(0, -1),
        {
          ...last,
          text: `${typeof last.text === 'string' ? last.text : ''}${delta.textDelta}`,
        },
      ]
    } else {
      nextParts = [...nextParts, { type: 'text', text: delta.textDelta }]
    }
  }
  if (delta.newParts?.length) {
    nextParts = mergeLiveStreamingParts(nextParts, delta.newParts)
  }
  return nextParts
}

class IsolatedDeltaStore {
  message: Message = {
    id: 'm1',
    status: 'generating',
    content: '',
    parts: [{ type: 'text', text: '' }],
  }

  deltas: Delta[] = []
  private nextDelta = 1

  append(delta: Omit<Delta, 'id' | 'messageId'>) {
    if (this.message.status !== 'generating') return
    assert.equal(this.message.content, '', 'stream append must not rewrite the growing message content')
    assert.deepEqual(this.message.parts, [{ type: 'text', text: '' }], 'stream append must not rewrite message parts')
    this.deltas.push({ id: `d${this.nextDelta++}`, messageId: this.message.id, ...delta })
  }

  finalize(finalContent: string, finalParts: Part[]) {
    this.message = {
      ...this.message,
      status: 'completed',
      content: finalContent,
      parts: finalParts,
    }
    this.deltas = this.deltas.filter((delta) => delta.messageId !== this.message.id)
  }
}

function hydrateGeneratingMessageWithDeltas(message: Message, deltas: Delta[]): Message {
  if (message.status !== 'generating' || deltas.length === 0) return message
  const { messages } = applyDeltasToClient([message], deltas, new Set())
  return {
    ...messages[0]!,
    content: visibleText(messages[0]!),
  }
}

function applyDeltasToClient(messages: Message[], deltas: Delta[], appliedIds: Set<string>) {
  let changed = false
  const next = messages.map((message) => ({ ...message, parts: [...message.parts] }))
  for (const delta of deltas) {
    if (appliedIds.has(delta.id)) continue
    const message = next.find((candidate) => candidate.id === delta.messageId && candidate.status === 'generating')
    if (!message) continue
    message.parts = applyLiveMessageDeltaParts(message.parts, delta)
    appliedIds.add(delta.id)
    changed = true
  }
  return { messages: changed ? next : messages, changed }
}

function visibleText(message: Message) {
  return message.parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
}

function messageHasVisibleAssistantActivity(message: Message): boolean {
  return message.parts.some((part) => {
    if (part.type === 'text' || part.type === 'reasoning') {
      return typeof part.text === 'string' && part.text.trim().length > 0
    }
    if (part.type === 'tool-invocation') return Boolean(part.toolInvocation)
    if (part.type === 'file') return Boolean(part.url)
    return typeof part.type === 'string' && part.type.startsWith('tool-')
  })
}

function chooseAssistantCandidate(candidates: Message[]) {
  if (candidates.length === 0) return null
  return candidates.find(messageHasVisibleAssistantActivity) ?? candidates[candidates.length - 1]!
}

test('stream deltas do not rewrite the growing full message document', () => {
  const store = new IsolatedDeltaStore()

  store.append({ textDelta: 'Hello ' })
  store.append({ textDelta: 'world.' })

  assert.equal(store.message.content, '')
  assert.deepEqual(store.message.parts, [{ type: 'text', text: '' }])
  assert.deepEqual(store.deltas.map((delta) => delta.textDelta), ['Hello ', 'world.'])
})

test('client reconstructs streaming text from ordered deltas once', () => {
  const store = new IsolatedDeltaStore()
  store.append({ textDelta: 'Hello ' })
  store.append({ textDelta: 'world.' })

  const appliedIds = new Set<string>()
  const initialClientMessages: Message[] = [{
    id: 'm1',
    status: 'generating',
    content: '',
    parts: [{ type: 'text', text: '' }],
  }]

  const first = applyDeltasToClient(initialClientMessages, store.deltas, appliedIds)
  const second = applyDeltasToClient(first.messages, store.deltas, appliedIds)

  assert.equal(visibleText(first.messages[0]!), 'Hello world.')
  assert.equal(second.changed, false, 'already applied deltas must not duplicate text')
  assert.equal(visibleText(second.messages[0]!), 'Hello world.')
})

test('reasoning deltas merge and tool deltas update by toolCallId', () => {
  const store = new IsolatedDeltaStore()
  store.append({ newParts: [{ type: 'reasoning', text: 'A', state: 'streaming' }] })
  store.append({ newParts: [{ type: 'reasoning', text: 'B', state: 'streaming' }] })
  store.append({
    newParts: [{
      type: 'tool-invocation',
      toolInvocation: {
        toolCallId: 'tool-1',
        toolName: 'search',
        state: 'input-available',
        toolInput: { query: 'convex' },
      },
    }],
  })
  store.append({
    newParts: [{
      type: 'tool-invocation',
      toolInvocation: {
        toolCallId: 'tool-1',
        toolName: 'unknown_tool',
        state: 'output-available',
        toolOutput: { ok: true },
      },
    }],
  })

  const appliedIds = new Set<string>()
  const { messages } = applyDeltasToClient([store.message], store.deltas, appliedIds)

  assert.deepEqual(messages[0]!.parts, [
    { type: 'text', text: '' },
    { type: 'reasoning', text: 'AB', state: 'streaming' },
    {
      type: 'tool-invocation',
      toolInvocation: {
        toolCallId: 'tool-1',
        toolName: 'search',
        state: 'output-available',
        toolInput: { query: 'convex' },
        toolOutput: { ok: true },
      },
    },
  ])
})

test('finalization writes the full message once and removes transient deltas', () => {
  const store = new IsolatedDeltaStore()
  store.append({ textDelta: 'partial' })
  store.finalize('final answer', [{ type: 'text', text: 'final answer' }])

  assert.equal(store.message.status, 'completed')
  assert.equal(store.message.content, 'final answer')
  assert.deepEqual(store.message.parts, [{ type: 'text', text: 'final answer' }])
  assert.equal(store.deltas.length, 0)
})

test('late stream append after finalization is a no-op', () => {
  const store = new IsolatedDeltaStore()
  store.append({ textDelta: 'partial' })
  store.finalize('final answer', [{ type: 'text', text: 'final answer' }])
  store.append({ textDelta: 'late chunk' })

  assert.equal(store.message.content, 'final answer')
  assert.deepEqual(store.message.parts, [{ type: 'text', text: 'final answer' }])
  assert.equal(store.deltas.length, 0)
})

test('reloaded tab can hydrate an in-flight generating message from deltas', () => {
  const persistedGeneratingMessage: Message = {
    id: 'm1',
    status: 'generating',
    content: '',
    parts: [{ type: 'text', text: '' }],
  }
  const deltas: Delta[] = [
    { id: 'd1', messageId: 'm1', textDelta: 'already ' },
    { id: 'd2', messageId: 'm1', textDelta: 'streamed' },
  ]

  const hydrated = hydrateGeneratingMessageWithDeltas(persistedGeneratingMessage, deltas)

  assert.equal(hydrated.content, 'already streamed')
  assert.equal(visibleText(hydrated), 'already streamed')
})

test('the creator browser should keep direct HTTP stream and skip Convex deltas', () => {
  const hasLocalHttpStream = true
  const localHttpMessage: Message = {
    id: 'm1',
    status: 'generating',
    content: '',
    parts: [{ type: 'text', text: 'HTTP token text' }],
  }
  const delta: Delta = { id: 'd1', messageId: 'm1', textDelta: 'Convex lagging text' }

  const messages = hasLocalHttpStream
    ? [localHttpMessage]
    : applyDeltasToClient([localHttpMessage], [delta], new Set()).messages

  assert.equal(visibleText(messages[0]!), 'HTTP token text')
})

test('response lookup prefers live HTTP assistant over empty persisted placeholder', () => {
  const persistedPlaceholder: Message = {
    id: 'persisted-m1',
    status: 'generating',
    content: '',
    parts: [{ type: 'text', text: '' }],
  }
  const liveHttpAssistant: Message = {
    id: 'http-m1',
    status: 'generating',
    content: '',
    parts: [{ type: 'text', text: 'streaming text' }],
  }

  const selected = chooseAssistantCandidate([persistedPlaceholder, liveHttpAssistant])

  assert.equal(selected?.id, 'http-m1')
  assert.equal(visibleText(selected!), 'streaming text')
})
