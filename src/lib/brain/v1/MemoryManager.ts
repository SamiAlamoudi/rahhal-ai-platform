/**
 * Sprint 81 — MemoryManager (Brain v1).
 * Separates session / conversation / long-term memory interfaces.
 * Does NOT replace production agent/memory.ts.
 */

import type { ConversationHistory } from './ConversationHistory'
import type { SessionState } from './SessionState'
import type {
  BrainV1ConversationMemory,
  BrainV1Intent,
  BrainV1LongTermMemory,
  BrainV1MissingField,
  BrainV1SessionMemory,
} from './types'

function defaultLongTerm(): BrainV1LongTermMemory {
  return {
    preferences: {
      cabinClass: null,
      maxStops: null,
      preferredAirlines: [],
      hotelStarMin: null,
      refundablePreferred: false,
    },
    profile: {
      userId: null,
      nationality: null,
      language: null,
      currency: null,
    },
    previousTrips: [],
    favoriteAirlines: [],
    favoriteHotels: [],
    budgetPreferences: { typicalAmount: null, currency: null },
  }
}

export class MemoryManager {
  private recentIntents: BrainV1Intent[] = []
  private pendingClarification: BrainV1MissingField | null = null
  private readonly session: SessionState
  private readonly history: ConversationHistory
  private longTerm: BrainV1LongTermMemory

  constructor(
    session: SessionState,
    history: ConversationHistory,
    longTerm?: BrainV1LongTermMemory,
  ) {
    this.session = session
    this.history = history
    this.longTerm = longTerm ?? defaultLongTerm()
  }

  getSessionMemory(): BrainV1SessionMemory {
    return this.session.getSnapshot()
  }

  getConversationMemory(): BrainV1ConversationMemory {
    return {
      turnCount: this.history.turnCount(),
      recentIntents: [...this.recentIntents],
      pendingClarification: this.pendingClarification,
      summary: this.recentIntents.length
        ? `Recent intents: ${this.recentIntents.join(', ')}`
        : null,
    }
  }

  getLongTermMemory(): BrainV1LongTermMemory {
    return {
      ...this.longTerm,
      preferences: {
        ...this.longTerm.preferences,
        preferredAirlines: [...this.longTerm.preferences.preferredAirlines],
      },
      previousTrips: [...this.longTerm.previousTrips],
      favoriteAirlines: [...this.longTerm.favoriteAirlines],
      favoriteHotels: [...this.longTerm.favoriteHotels],
      budgetPreferences: { ...this.longTerm.budgetPreferences },
      profile: { ...this.longTerm.profile },
    }
  }

  rememberIntent(intent: BrainV1Intent): void {
    this.recentIntents = [...this.recentIntents, intent].slice(-8)
    this.session.updateIntent(intent)
  }

  setPendingClarification(field: BrainV1MissingField | null): void {
    this.pendingClarification = field
  }

  seedLongTerm(partial: Partial<BrainV1LongTermMemory>): void {
    this.longTerm = {
      ...this.longTerm,
      ...partial,
      preferences: {
        ...this.longTerm.preferences,
        ...partial.preferences,
        preferredAirlines: partial.preferences?.preferredAirlines
          ?? this.longTerm.preferences.preferredAirlines,
      },
      profile: { ...this.longTerm.profile, ...partial.profile },
      previousTrips: partial.previousTrips ?? this.longTerm.previousTrips,
      favoriteAirlines: partial.favoriteAirlines ?? this.longTerm.favoriteAirlines,
      favoriteHotels: partial.favoriteHotels ?? this.longTerm.favoriteHotels,
      budgetPreferences: {
        ...this.longTerm.budgetPreferences,
        ...partial.budgetPreferences,
      },
    }
  }
}

export function createMemoryManager(
  session: SessionState,
  history: ConversationHistory,
  longTerm?: Partial<BrainV1LongTermMemory>,
): MemoryManager {
  const manager = new MemoryManager(session, history)
  if (longTerm) manager.seedLongTerm(longTerm)
  return manager
}
