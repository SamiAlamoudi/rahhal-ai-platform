import type { VoiceEvent, VoiceEventPriority } from './types'

export type VoiceQueueKind = 'incoming' | 'outgoing'

export interface VoiceQueueItem {
  id: string
  kind: VoiceQueueKind
  priority: VoiceEventPriority
  event: VoiceEvent
  /** Higher wins; critical interruptions beat normal assistant speech. */
  rank: number
  enqueuedAt: string
  cancelled: boolean
}

const PRIORITY_RANK: Record<VoiceEventPriority, number> = {
  normal: 1,
  high: 5,
  critical: 100,
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

/**
 * Cancelable priority queue for voice events / assistant responses.
 * Interruptions use `critical` priority and cancel lower outgoing work.
 */
export function createVoiceQueue() {
  const items: VoiceQueueItem[] = []

  const sortStable = () => {
    items.sort((a, b) => {
      if (a.cancelled !== b.cancelled) return a.cancelled ? 1 : -1
      if (b.rank !== a.rank) return b.rank - a.rank
      return a.enqueuedAt.localeCompare(b.enqueuedAt)
    })
  }

  return {
    enqueue(input: {
      kind: VoiceQueueKind
      event: VoiceEvent
      priority?: VoiceEventPriority
    }): VoiceQueueItem {
      const priority = input.priority ?? input.event.priority ?? 'normal'
      const item: VoiceQueueItem = {
        id: newId('vq'),
        kind: input.kind,
        priority,
        event: { ...input.event, priority },
        rank: PRIORITY_RANK[priority],
        enqueuedAt: new Date().toISOString(),
        cancelled: false,
      }
      items.push(item)
      sortStable()
      return item
    },

    /** Cancel a specific item. */
    cancel(id: string): boolean {
      const item = items.find((row) => row.id === id)
      if (!item || item.cancelled) return false
      item.cancelled = true
      sortStable()
      return true
    },

    /**
     * Cancel all outgoing (assistant) items with rank below `minRank`.
     * Used when the user interrupts — pending speech must not play.
     */
    cancelOutgoingBelow(minRank: number): number {
      let count = 0
      for (const item of items) {
        if (item.kind === 'outgoing' && !item.cancelled && item.rank < minRank) {
          item.cancelled = true
          count += 1
        }
      }
      if (count) sortStable()
      return count
    },

    /** Peek next non-cancelled item for a kind (or any). */
    peek(kind?: VoiceQueueKind): VoiceQueueItem | null {
      return (
        items.find((row) => !row.cancelled && (kind ? row.kind === kind : true)) ?? null
      )
    },

    /** Dequeue next non-cancelled item. */
    dequeue(kind?: VoiceQueueKind): VoiceQueueItem | null {
      const idx = items.findIndex(
        (row) => !row.cancelled && (kind ? row.kind === kind : true),
      )
      if (idx < 0) return null
      const [item] = items.splice(idx, 1)
      return item ?? null
    },

    clear(kind?: VoiceQueueKind): void {
      if (!kind) {
        items.length = 0
        return
      }
      for (let i = items.length - 1; i >= 0; i -= 1) {
        if (items[i]?.kind === kind) items.splice(i, 1)
      }
    },

    list(includeCancelled = false): VoiceQueueItem[] {
      return items
        .filter((row) => includeCancelled || !row.cancelled)
        .map((row) => ({ ...row, event: { ...row.event } }))
    },

    size(kind?: VoiceQueueKind): number {
      return items.filter(
        (row) => !row.cancelled && (kind ? row.kind === kind : true),
      ).length
    },
  }
}

export type VoiceQueue = ReturnType<typeof createVoiceQueue>
