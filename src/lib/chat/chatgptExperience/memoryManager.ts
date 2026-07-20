/**
 * Sprint 44 — Memory Manager.
 * Reuses Sprint 28 MemoryContextEngine; adds rolling windows + tool-result memory.
 * Does not invent travel business logic.
 */

import {
  MemoryContextEngine,
  type MemoryContextEngineHandle,
} from '../../brain/memory/memoryContextEngine'
import { ensureEnriched } from '../../brain/memory/enrichedMemory'
import type { MemorySnapshot } from './types'
import { logExperience } from './experienceLogger'

const DEFAULT_WINDOW = 12
const MAX_TOOL_RESULTS = 8

export type MemoryManagerHandle = {
  absorbTurn: (input: {
    conversationId: string
    userText: string
    locale?: 'ar' | 'en'
    userId?: string | null
    history?: Array<{ role: string; content: string }>
    toolResult?: string | null
  }) => MemorySnapshot
  getSnapshot: (conversationId: string) => MemorySnapshot | null
  rememberToolResult: (conversationId: string, summary: string) => void
  clear: (conversationId?: string) => void
}

export function createMemoryManager(options?: {
  engine?: MemoryContextEngineHandle
  windowSize?: number
  enabled?: boolean
}): MemoryManagerHandle {
  const engine =
    options?.engine
    ?? MemoryContextEngine({ enabled: options?.enabled ?? true })
  const windowSize = options?.windowSize ?? DEFAULT_WINDOW
  const toolResults = new Map<string, string[]>()
  const cache = new Map<string, MemorySnapshot>()

  function buildSnapshot(input: {
    conversationId: string
    history: Array<{ role: string; content: string }>
    userId?: string | null
  }): MemorySnapshot {
    const short = engine.getShortTerm(input.conversationId)
    const memory = short?.memory ? ensureEnriched(short.memory) : null
    const longTerm = engine.getLongTerm(input.userId)
    const rolling = input.history.slice(-windowSize)
    const destinations = unique([
      ...(memory?.destinations ?? []),
      ...(memory?.destination ? [memory.destination] : []),
    ])
    const summary = short?.summary?.text ?? null

    return {
      conversationId: input.conversationId,
      previousMessages: rolling,
      preferences: {
        destinations,
        budgets: [
          {
            amount: memory?.budget?.amount ?? longTerm?.budgetRange?.max ?? null,
            currency:
              memory?.budget?.currency
              ?? longTerm?.budgetRange?.currency
              ?? memory?.currency
              ?? null,
          },
        ],
        travelStyle: longTerm?.tripStyle?.style ?? memory?.activities?.[0] ?? null,
        companions:
          memory?.travelers?.count != null
            ? `${memory.travelers.count}`
            : longTerm?.typicalTravelerCount != null
              ? `${longTerm.typicalTravelerCount}`
              : null,
      },
      unfinished: short?.missingSlots?.map(String) ?? [],
      previousToolResults: [...(toolResults.get(input.conversationId) ?? [])],
      summary,
      rollingWindow: rolling,
    }
  }

  return {
    absorbTurn(input) {
      const started = Date.now()
      if (engine.isEnabled()) {
        engine.runTurn({
          conversationId: input.conversationId,
          userText: input.userText,
          locale: input.locale ?? 'en',
          userId: input.userId,
          persistLongTerm: true,
        })
      }
      if (input.toolResult?.trim()) {
        remember(input.conversationId, input.toolResult.trim())
      }
      const history = input.history
        ?? (engine.getShortTerm(input.conversationId)?.history.turns.map((t) => ({
          role: t.role,
          content: t.content,
        })) ?? [])
      const snap = buildSnapshot({
        conversationId: input.conversationId,
        history: [
          ...history,
          { role: 'user', content: input.userText },
        ],
        userId: input.userId,
      })
      cache.set(input.conversationId, snap)
      logExperience({
        stage: 'memory',
        event: 'absorb_turn',
        durationMs: Date.now() - started,
        meta: {
          window: snap.rollingWindow.length,
          summarized: Boolean(snap.summary),
          destinations: snap.preferences.destinations.length,
        },
      })
      return snap
    },
    getSnapshot(conversationId) {
      return cache.get(conversationId) ?? null
    },
    rememberToolResult(conversationId, summary) {
      remember(conversationId, summary)
    },
    clear(conversationId) {
      if (conversationId) {
        cache.delete(conversationId)
        toolResults.delete(conversationId)
        engine.clear(conversationId)
        return
      }
      cache.clear()
      toolResults.clear()
      engine.clear()
    },
  }

  function remember(conversationId: string, summary: string) {
    const prev = toolResults.get(conversationId) ?? []
    const next = [...prev, summary].slice(-MAX_TOOL_RESULTS)
    toolResults.set(conversationId, next)
  }
}

function unique(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    const t = v.trim()
    if (!t) continue
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out
}
