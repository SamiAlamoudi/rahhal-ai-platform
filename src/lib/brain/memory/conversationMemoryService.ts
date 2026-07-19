/**
 * Sprint 28 — ConversationMemoryService
 * Short-term conversation memory with TTL, enrichment, and persistence in-process.
 */

import { createEmptyHistory, ConversationHistoryApi } from '../conversationHistory'
import type { BrainLocale, ConversationHistory, TravelIntent } from '../types'
import {
  applyEnrichedPatch,
  cloneEnrichedMemory,
  createEmptyEnrichedMemory,
  ensureEnriched,
} from './enrichedMemory'
import { applySensitiveExpiration, expiryFromNow, isExpired, resolvePolicy } from './expiration'
import type {
  EnrichedConversationMemory,
  MemoryExpirationPolicy,
  ShortTermMemoryState,
} from './types'

export type ConversationMemoryServiceOptions = {
  policy?: Partial<MemoryExpirationPolicy>
  /** Inject clock for tests. */
  now?: () => number
}

export type ConversationMemoryServiceHandle = {
  getOrCreate: (input: {
    conversationId: string
    userId?: string | null
    locale?: BrainLocale
  }) => ShortTermMemoryState
  get: (conversationId: string) => ShortTermMemoryState | null
  save: (state: ShortTermMemoryState) => ShortTermMemoryState
  updateMemory: (
    conversationId: string,
    patch: Partial<EnrichedConversationMemory>,
  ) => ShortTermMemoryState | null
  appendTurn: (input: {
    conversationId: string
    role: 'user' | 'assistant' | 'system'
    content: string
    intent?: TravelIntent | null
  }) => ShortTermMemoryState | null
  setSummary: (
    conversationId: string,
    summary: ShortTermMemoryState['summary'],
    recentHistory?: ConversationHistory,
  ) => ShortTermMemoryState | null
  setFollowUps: (
    conversationId: string,
    missingSlots: ShortTermMemoryState['missingSlots'],
    followUpQuestions: string[],
  ) => ShortTermMemoryState | null
  touch: (conversationId: string) => ShortTermMemoryState | null
  purgeExpired: () => number
  clear: (conversationId?: string) => void
  size: () => number
  policy: () => MemoryExpirationPolicy
  snapshot: (conversationId: string) => ShortTermMemoryState | null
}

function cloneState(state: ShortTermMemoryState): ShortTermMemoryState {
  return {
    ...state,
    memory: cloneEnrichedMemory(state.memory),
    history: {
      conversationId: state.history.conversationId,
      turns: state.history.turns.map((t) => ({ ...t })),
    },
    summary: state.summary
      ? {
          ...state.summary,
          keyFacts: [...state.summary.keyFacts],
          coveredTurnIds: [...state.summary.coveredTurnIds],
        }
      : null,
    followUpQuestions: [...state.followUpQuestions],
    missingSlots: [...state.missingSlots],
  }
}

/**
 * In-memory short-term conversation store (privacy: process-local only).
 */
export function ConversationMemoryService(
  options: ConversationMemoryServiceOptions = {},
): ConversationMemoryServiceHandle {
  const store = new Map<string, ShortTermMemoryState>()
  const policy = resolvePolicy(options.policy)
  const clock = options.now ?? (() => Date.now())

  function hydrate(state: ShortTermMemoryState): ShortTermMemoryState | null {
    if (isExpired(state.expiresAt, clock())) {
      store.delete(state.conversationId)
      return null
    }
    const memory = applySensitiveExpiration(
      ensureEnriched(state.memory),
      policy,
      clock(),
    )
    return cloneState({ ...state, memory })
  }

  return {
    policy: () => ({ ...policy }),

    getOrCreate(input) {
      const existing = store.get(input.conversationId)
      if (existing) {
        const hydrated = hydrate(existing)
        if (hydrated) return hydrated
      }
      const now = clock()
      const memory = createEmptyEnrichedMemory(
        input.conversationId,
        input.locale ?? 'ar',
      )
      const state: ShortTermMemoryState = {
        conversationId: input.conversationId,
        userId: input.userId ?? null,
        memory,
        history: createEmptyHistory(input.conversationId),
        summary: null,
        followUpQuestions: [],
        missingSlots: [],
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        expiresAt: expiryFromNow(policy.shortTermTtlMs, now),
        turnCount: 0,
      }
      store.set(input.conversationId, state)
      return cloneState(state)
    },

    get(conversationId) {
      const existing = store.get(conversationId)
      if (!existing) return null
      return hydrate(existing)
    },

    snapshot(conversationId) {
      return this.get(conversationId)
    },

    save(state) {
      const now = clock()
      const next: ShortTermMemoryState = {
        ...cloneState(state),
        memory: ensureEnriched(state.memory),
        updatedAt: new Date(now).toISOString(),
        expiresAt: expiryFromNow(policy.shortTermTtlMs, now),
      }
      store.set(state.conversationId, next)
      return cloneState(next)
    },

    updateMemory(conversationId, patch) {
      const current = this.get(conversationId)
      if (!current) return null
      const memory = applyEnrichedPatch(current.memory, patch)
      return this.save({ ...current, memory })
    },

    appendTurn(input) {
      const current = this.get(input.conversationId)
      if (!current) return null
      const history = ConversationHistoryApi.append(current.history, {
        role: input.role,
        content: input.content,
        intent: input.intent ?? null,
      })
      return this.save({
        ...current,
        history,
        turnCount: current.turnCount + 1,
      })
    },

    setSummary(conversationId, summary, recentHistory) {
      const current = this.get(conversationId)
      if (!current) return null
      return this.save({
        ...current,
        summary,
        history: recentHistory ?? current.history,
      })
    },

    setFollowUps(conversationId, missingSlots, followUpQuestions) {
      const current = this.get(conversationId)
      if (!current) return null
      return this.save({
        ...current,
        missingSlots: [...missingSlots],
        followUpQuestions: [...followUpQuestions],
      })
    },

    touch(conversationId) {
      const current = this.get(conversationId)
      if (!current) return null
      return this.save(current)
    },

    purgeExpired() {
      let removed = 0
      for (const [id, state] of store) {
        if (isExpired(state.expiresAt, clock())) {
          store.delete(id)
          removed += 1
        }
      }
      return removed
    },

    clear(conversationId) {
      if (conversationId) store.delete(conversationId)
      else store.clear()
    },

    size() {
      this.purgeExpired()
      return store.size
    },
  }
}

let defaultService: ConversationMemoryServiceHandle | null = null

export function getConversationMemoryService(
  options?: ConversationMemoryServiceOptions,
): ConversationMemoryServiceHandle {
  if (!defaultService) defaultService = ConversationMemoryService(options)
  return defaultService
}

export function resetConversationMemoryService(): void {
  defaultService?.clear()
  defaultService = null
}
