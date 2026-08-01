/**
 * Sprint 82 — MemoryManager (Brain v1).
 * Session / conversation / preference / long-term memory interfaces.
 * No persistence yet.
 */

import type { ConversationHistory } from './ConversationHistory'
import type { SessionState } from './SessionState'
import type {
  BrainV1ConversationMemory,
  BrainV1Intent,
  BrainV1LongTermMemory,
  BrainV1MissingField,
  BrainV1PreferenceMemory,
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
    previousSelections: [],
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

  getPreferenceMemory(): BrainV1PreferenceMemory {
    return {
      cabinClass: this.longTerm.preferences.cabinClass,
      maxStops: this.longTerm.preferences.maxStops,
      preferredAirlines: [
        ...this.longTerm.preferences.preferredAirlines,
        ...this.longTerm.favoriteAirlines,
      ],
      hotelStarMin: this.longTerm.preferences.hotelStarMin,
      refundablePreferred: this.longTerm.preferences.refundablePreferred,
      currency:
        this.longTerm.profile.currency
        ?? this.longTerm.budgetPreferences.currency,
      typicalBudget: this.longTerm.budgetPreferences.typicalAmount,
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
      previousSelections: [...(this.longTerm.previousSelections ?? [])],
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
      previousSelections:
        partial.previousSelections ?? this.longTerm.previousSelections ?? [],
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
