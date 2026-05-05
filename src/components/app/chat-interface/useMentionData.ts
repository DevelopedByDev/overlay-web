import { useCallback, useRef, useState } from 'react'
import type { MentionCategory, MentionItem, MentionType } from './mention-types'

interface CachedData {
  files: MentionItem[]
  connectors: MentionItem[]
  automations: MentionItem[]
  skills: MentionItem[]
  mcps: MentionItem[]
  chats: MentionItem[]
}

const CATEGORY_META: Array<{ type: MentionType; label: string; icon: string }> = [
  { type: 'file', label: 'Files', icon: 'FileText' },
  { type: 'connector', label: 'Connectors', icon: 'Plug' },
  { type: 'automation', label: 'Automations', icon: 'Zap' },
  { type: 'skill', label: 'Skills', icon: 'Sparkles' },
  { type: 'mcp', label: 'MCP Servers', icon: 'Server' },
  { type: 'chat', label: 'Chats', icon: 'MessageSquare' },
]

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  return lower.includes(q)
}

function scoreMatch(item: MentionItem, query: string): number {
  const q = query.toLowerCase()
  const name = item.name.toLowerCase()
  if (name === q) return 100
  if (name.startsWith(q)) return 80
  if (name.includes(q)) return 60
  if (item.description?.toLowerCase().includes(q)) return 40
  return 0
}

export function useMentionData() {
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef<CachedData | null>(null)
  const fetchingRef = useRef(false)

  const fetchAllData = useCallback(async (): Promise<CachedData> => {
    if (cacheRef.current) return cacheRef.current

    if (fetchingRef.current) {
      // Wait for in-flight fetch
      await new Promise<void>((resolve) => {
        const check = () => {
          if (!fetchingRef.current) { resolve(); return }
          setTimeout(check, 50)
        }
        check()
      })
      return cacheRef.current!
    }

    fetchingRef.current = true
    setLoading(true)

    try {
      const [filesRes, connectorsRes, automationsRes, skillsRes, mcpsRes, chatsRes] =
        await Promise.allSettled([
          fetch('/api/app/files').then((r) => r.ok ? r.json() : []),
          fetch('/api/app/integrations').then((r) => r.ok ? r.json() : { items: [] }),
          fetch('/api/app/automations').then((r) => r.ok ? r.json() : []),
          fetch('/api/app/skills').then((r) => r.ok ? r.json() : []),
          fetch('/api/app/mcps').then((r) => r.ok ? r.json() : []),
          fetch('/api/app/conversations').then((r) => r.ok ? r.json() : []),
        ])

      const files: MentionItem[] = (
        filesRes.status === 'fulfilled' ? (Array.isArray(filesRes.value) ? filesRes.value : []) : []
      ).map((f: { _id: string; name?: string; kind?: string; mimeType?: string }) => ({
        type: 'file' as const,
        id: f._id,
        name: f.name || 'Untitled',
        description: f.kind || f.mimeType || 'file',
        icon: 'FileText',
      }))

      const connectorsRaw = connectorsRes.status === 'fulfilled' ? connectorsRes.value : { items: [] }
      const connectors: MentionItem[] = (connectorsRaw.items || []).map(
        (c: { slug: string; name: string; description?: string; logoUrl?: string }) => ({
          type: 'connector' as const,
          id: c.slug,
          name: c.name,
          description: c.description || '',
          icon: 'Plug',
          logoUrl: c.logoUrl,
        })
      )

      const automations: MentionItem[] = (
        automationsRes.status === 'fulfilled' ? (Array.isArray(automationsRes.value) ? automationsRes.value : []) : []
      )
        .filter((a: { deletedAt?: number }) => !a.deletedAt)
        .map((a: { _id: string; name?: string; description?: string }) => ({
          type: 'automation' as const,
          id: a._id,
          name: a.name || 'Untitled automation',
          description: a.description || '',
          icon: 'Zap',
        }))

      const skills: MentionItem[] = (
        skillsRes.status === 'fulfilled' ? (Array.isArray(skillsRes.value) ? skillsRes.value : []) : []
      )
        .filter((s: { enabled?: boolean }) => s.enabled !== false)
        .map((s: { _id: string; name: string; description?: string }) => ({
          type: 'skill' as const,
          id: s._id,
          name: s.name,
          description: s.description || '',
          icon: 'Sparkles',
        }))

      const mcps: MentionItem[] = (
        mcpsRes.status === 'fulfilled' ? (Array.isArray(mcpsRes.value) ? mcpsRes.value : []) : []
      ).map((m: { _id: string; name: string; description?: string; url?: string }) => ({
        type: 'mcp' as const,
        id: m._id,
        name: m.name,
        description: m.description || m.url || '',
        icon: 'Server',
      }))

      const chats: MentionItem[] = (
        chatsRes.status === 'fulfilled' ? (Array.isArray(chatsRes.value) ? chatsRes.value : []) : []
      ).map((c: { _id: string; title: string }) => ({
        type: 'chat' as const,
        id: c._id,
        name: c.title || 'Untitled chat',
        icon: 'MessageSquare',
      }))

      const data: CachedData = { files, connectors, automations, skills, mcps, chats }
      cacheRef.current = data
      return data
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  const search = useCallback(
    async (query: string): Promise<MentionCategory[]> => {
      const data = await fetchAllData()
      const q = query.trim()

      return CATEGORY_META.map((cat) => {
        const items = data[cat.type === 'connector' ? 'connectors' : `${cat.type}s` as keyof CachedData]
        const filtered = q
          ? items
              .filter((item) => fuzzyMatch(item.name, q) || fuzzyMatch(item.description || '', q))
              .sort((a, b) => scoreMatch(b, q) - scoreMatch(a, q))
          : items
        return {
          type: cat.type,
          label: cat.label,
          icon: cat.icon,
          items: filtered.slice(0, 10),
        }
      }).filter((cat) => cat.items.length > 0)
    },
    [fetchAllData]
  )

  const invalidateCache = useCallback(() => {
    cacheRef.current = null
  }, [])

  return { search, loading, invalidateCache, fetchAllData }
}
