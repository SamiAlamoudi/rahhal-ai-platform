import type { VoiceTimelineEntry, VoiceTimelineKind } from './types'

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

/**
 * Conversation timeline — user/assistant speech, thinking, latency, errors, reconnects.
 */
export function createVoiceTimeline(conversationId: string) {
  const entries: VoiceTimelineEntry[] = []
  const openByKey = new Map<string, string>()

  const push = (entry: VoiceTimelineEntry) => {
    entries.push(entry)
    return entry
  }

  return {
    conversationId,

    mark(
      kind: VoiceTimelineKind,
      label: string,
      meta?: Record<string, unknown>,
    ): VoiceTimelineEntry {
      const now = new Date().toISOString()
      return push({
        id: newId('vtl'),
        conversationId,
        kind,
        label,
        startedAt: now,
        endedAt: now,
        durationMs: 0,
        meta,
      })
    },

    begin(
      key: string,
      kind: VoiceTimelineKind,
      label: string,
      meta?: Record<string, unknown>,
    ): VoiceTimelineEntry {
      const existing = openByKey.get(key)
      if (existing) {
        this.end(key)
      }
      const entry: VoiceTimelineEntry = {
        id: newId('vtl'),
        conversationId,
        kind,
        label,
        startedAt: new Date().toISOString(),
        endedAt: null,
        durationMs: null,
        meta,
      }
      openByKey.set(key, entry.id)
      return push(entry)
    },

    end(key: string, meta?: Record<string, unknown>): VoiceTimelineEntry | null {
      const id = openByKey.get(key)
      if (!id) return null
      openByKey.delete(key)
      const entry = entries.find((row) => row.id === id)
      if (!entry) return null
      const endedAt = new Date().toISOString()
      entry.endedAt = endedAt
      entry.durationMs = Math.max(
        0,
        Date.parse(endedAt) - Date.parse(entry.startedAt),
      )
      if (meta) entry.meta = { ...entry.meta, ...meta }
      return { ...entry }
    },

    sampleLatency(label: string, durationMs: number, meta?: Record<string, unknown>) {
      const now = new Date().toISOString()
      return push({
        id: newId('vtl'),
        conversationId,
        kind: 'latency',
        label,
        startedAt: now,
        endedAt: now,
        durationMs,
        meta,
      })
    },

    list(): VoiceTimelineEntry[] {
      return entries.map((row) => ({ ...row, meta: row.meta ? { ...row.meta } : undefined }))
    },

    openKeys(): string[] {
      return [...openByKey.keys()]
    },
  }
}

export type VoiceTimeline = ReturnType<typeof createVoiceTimeline>
