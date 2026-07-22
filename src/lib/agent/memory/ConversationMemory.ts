/**
 * Sprint 112 — ConversationMemory
 * Cross-conversation memory: destinations, searches, accepted/rejected itineraries.
 */

import type {
  ConversationMemoryState,
  ConversationTurnRecord,
  PreferenceValue,
  RecommendationMemoryRecord,
  SearchMemoryRecord,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

export function emptyConversationMemory(
  userId: string,
): ConversationMemoryState {
  return {
    userId,
    conversationIds: [],
    turns: [],
    previousDestinations: [],
    recentSearches: [],
    previousRecommendations: [],
    acceptedItineraries: [],
    rejectedItineraries: [],
    updatedAt: nowIso(),
  }
}

function upsertDestination(
  list: PreferenceValue[],
  destination: string,
): PreferenceValue[] {
  const key = destination.toLowerCase()
  const idx = list.findIndex((d) => d.value.toLowerCase() === key)
  if (idx < 0) {
    return [
      ...list,
      {
        value: destination,
        confidence: 0.55,
        polarity: 'prefer',
        observations: 1,
        updatedAt: nowIso(),
        source: 'history',
      },
    ]
  }
  const prev = list[idx]!
  const copy = list.slice()
  copy[idx] = {
    ...prev,
    confidence: Math.min(1, prev.confidence + 0.08),
    observations: prev.observations + 1,
    updatedAt: nowIso(),
  }
  return copy
}

export interface ConversationMemoryStore {
  get(userId: string): ConversationMemoryState | null
  save(state: ConversationMemoryState): ConversationMemoryState
  clear(userId?: string): void
}

export function createConversationMemoryStore(
  seed?: Map<string, ConversationMemoryState>,
): ConversationMemoryStore {
  const map = seed ?? new Map<string, ConversationMemoryState>()
  return {
    get(userId) {
      const v = map.get(userId)
      return v ? clone(v) : null
    },
    save(state) {
      const next = clone({ ...state, updatedAt: nowIso() })
      map.set(state.userId, next)
      return clone(next)
    },
    clear(userId) {
      if (userId) map.delete(userId)
      else map.clear()
    },
  }
}

let defaultConversationStore: ConversationMemoryStore | null = null

export function getConversationMemoryStore(): ConversationMemoryStore {
  if (!defaultConversationStore) {
    defaultConversationStore = createConversationMemoryStore()
  }
  return defaultConversationStore
}

export function resetConversationMemoryStore(): void {
  defaultConversationStore = createConversationMemoryStore()
}

export function getOrCreateConversationMemory(
  userId: string,
  store: ConversationMemoryStore = getConversationMemoryStore(),
): ConversationMemoryState {
  return store.get(userId) ?? emptyConversationMemory(userId)
}

export function recordConversationTurn(
  state: ConversationMemoryState,
  turn: Omit<ConversationTurnRecord, 'at'> & { at?: string },
): ConversationMemoryState {
  const conversationIds = state.conversationIds.includes(turn.conversationId)
    ? state.conversationIds
    : [...state.conversationIds, turn.conversationId]
  const turns = [
    ...state.turns,
    {
      conversationId: turn.conversationId,
      role: turn.role,
      text: turn.text,
      at: turn.at ?? nowIso(),
    },
  ].slice(-200)
  return {
    ...state,
    conversationIds,
    turns,
    updatedAt: nowIso(),
  }
}

export function recordSearch(
  state: ConversationMemoryState,
  search: Omit<SearchMemoryRecord, 'at'> & { at?: string },
): ConversationMemoryState {
  const recentSearches = [
    {
      ...search,
      at: search.at ?? nowIso(),
    },
    ...state.recentSearches,
  ].slice(0, 50)

  let previousDestinations = state.previousDestinations
  if (search.destination?.trim()) {
    previousDestinations = upsertDestination(
      previousDestinations,
      search.destination.trim(),
    )
  }

  const conversationIds = state.conversationIds.includes(search.conversationId)
    ? state.conversationIds
    : [...state.conversationIds, search.conversationId]

  return {
    ...state,
    conversationIds,
    recentSearches,
    previousDestinations,
    updatedAt: nowIso(),
  }
}

export function recordRecommendationOutcome(
  state: ConversationMemoryState,
  record: Omit<RecommendationMemoryRecord, 'at'> & { at?: string },
): ConversationMemoryState {
  const full: RecommendationMemoryRecord = {
    ...record,
    at: record.at ?? nowIso(),
  }
  const previousRecommendations = [full, ...state.previousRecommendations].slice(
    0,
    100,
  )
  let acceptedItineraries = state.acceptedItineraries
  let rejectedItineraries = state.rejectedItineraries
  if (full.outcome === 'accepted') {
    acceptedItineraries = [full, ...acceptedItineraries].slice(0, 50)
  } else if (full.outcome === 'rejected') {
    rejectedItineraries = [full, ...rejectedItineraries].slice(0, 50)
  }

  let previousDestinations = state.previousDestinations
  if (full.destination?.trim()) {
    previousDestinations = upsertDestination(
      previousDestinations,
      full.destination.trim(),
    )
  }

  return {
    ...state,
    previousRecommendations,
    acceptedItineraries,
    rejectedItineraries,
    previousDestinations,
    updatedAt: nowIso(),
  }
}

export class ConversationMemory {
  private readonly store: ConversationMemoryStore

  constructor(store: ConversationMemoryStore = getConversationMemoryStore()) {
    this.store = store
  }

  lookup(userId: string): ConversationMemoryState {
    return getOrCreateConversationMemory(userId, this.store)
  }

  save(state: ConversationMemoryState): ConversationMemoryState {
    return this.store.save(state)
  }
}

export function createConversationMemory(
  store?: ConversationMemoryStore,
): ConversationMemory {
  return new ConversationMemory(store)
}
