/**
 * Shared system text for Ask / Act so models reliably use knowledge tools.
 */

/** Ask mode: retrieval + memory writes; note/file mutations stay in Act mode. */
export const ASK_KNOWLEDGE_TOOLS_NOTE = [
  'Tools in Ask mode (when available): list_skills (user-configured task instructions), search_knowledge (notebook files and memories), save_memory / update_memory / delete_memory when the user shares or corrects durable facts, list_notes / get_note (read-only), perplexity_search (live web when AI Gateway is configured), and filtered Composio integrations.',
  'IMPORTANT: Call list_skills at the start of any task to discover whether a relevant skill applies — especially for writing, coding, workflows, or domain-specific requests. If a matching skill is found, follow its instructions for this task.',
  'Use search_knowledge for facts beyond AUTO_RETRIEVED_KNOWLEDGE or the memory list above; use perplexity_search for current events, news, or anything requiring the public web.',
  'You cannot create, update, or delete notebook notes in Ask mode — use Act mode for note CRUD. You CAN save, update, or delete memories in Ask mode when the user states preferences or facts worth recalling later.',
  'When your answer uses AUTO_RETRIEVED_KNOWLEDGE, search_knowledge, or web search results, end with **Sources:** (and include URLs/snippets from web search where relevant).',
].join('\n')

/** Act mode: knowledge + web search tool guidance (Composio remains separate in route instructions). */
export const ACT_KNOWLEDGE_WEB_TOOLS_NOTE = [
  'You have search_knowledge (hybrid search over the user\'s notebook files and memories), perplexity_search (live web via AI Gateway when configured), and full notes CRUD (create_note, update_note, delete_note, list_notes, get_note).',
  'Use search_knowledge for extra retrieval beyond AUTO_RETRIEVED_KNOWLEDGE; use perplexity_search for current web information.',
  'When you use AUTO_RETRIEVED_KNOWLEDGE, search_knowledge, or web search results, end your reply with **Sources:** listing [n] labels as instructed in that block.',
].join('\n')

/** Instructs the model when to call save_memory (preferences, facts, standing instructions). */
export const MEMORY_SAVE_PROTOCOL = [
  'Memory tool (save_memory) — required behavior:',
  '- When the user states a personal fact, preference, goal, identity detail, or standing instruction they would reasonably want recalled in a future chat, you MUST call save_memory with one short factual line (e.g. "User likes pasta." or "User prefers British spelling.").',
  '- Examples that REQUIRE save_memory: food or style preferences; job or role; timezone or locale; "always do X"; durable constraints on how they want answers.',
  '- Do NOT use save_memory for pure small talk, one-off tasks, hypotheticals, or clearly transient remarks with no lasting meaning.',
  '- Call save_memory in the same turn as your reply when applicable (before or after your answer text in the tool loop); never skip it when they clearly share something to remember.',
].join('\n')

/** User attached documents this turn — already indexed; steer search_knowledge. */
export function indexedFilesSystemNote(fileNames: string[]): string {
  if (fileNames.length === 0) return ''
  const list = fileNames.map((n) => `"${n}"`).join(', ')
  return (
    `\n\n[Documents indexed this turn: ${list}. They are saved as notebook files and embedded for hybrid search. ` +
    `You MUST call search_knowledge with targeted queries (titles, section names, or the user's question) before answering — do not claim you cannot access these files. ` +
    `Snippets may not appear in AUTO_RETRIEVED_KNOWLEDGE for this message.]`
  )
}

/**
 * Clone UI messages and append a model-only text part to the latest user turn so the model
 * always sees explicit attachment context (client bubbles stay clean).
 */
export function cloneMessagesWithIndexedFileHint<T extends { role: string; parts?: unknown[] }>(
  inputMessages: T[],
  fileNames: string[],
): T[] {
  const names = fileNames.filter((n) => typeof n === 'string' && n.trim().length > 0)
  if (names.length === 0) return inputMessages

  const hint =
    `[Notebook files indexed for this turn: ${names.map((n) => `"${n}"`).join(', ')}. ` +
    `Call search_knowledge with relevant queries to read their content before you answer. ` +
    `Do not tell the user you cannot see or open these documents.]`

  const msgs = inputMessages.map((m) => ({
    ...m,
    parts: m.parts ? m.parts.map((p) => (typeof p === 'object' && p !== null ? { ...p } : p)) : undefined,
  })) as T[]

  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]!.role !== 'user') continue
    const prev = msgs[i]!.parts ? [...msgs[i]!.parts!] : []
    prev.push({ type: 'text', text: hint } as (typeof prev)[number])
    msgs[i] = { ...msgs[i]!, parts: prev }
    break
  }

  return msgs
}
