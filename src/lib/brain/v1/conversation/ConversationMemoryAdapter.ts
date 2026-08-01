/**
 * Sprint 85 — Conversation Memory Adapter.
 * Reads from existing Brain memory interfaces. No persistence changes.
 */

import type { BrainV1LongTermMemory, BrainV1PreferenceMemory } from '../types'
import type { TravelPlanSlots } from '../planning/types'

export interface ConversationMemorySnapshot {
  preferenceMemory: BrainV1PreferenceMemory
  longTermNotes: string[]
  softSlotDefaults: Partial<TravelPlanSlots>
}

function emptyPreferences(): BrainV1PreferenceMemory {
  return {
    cabinClass: null,
    maxStops: null,
    preferredAirlines: [],
    hotelStarMin: null,
    refundablePreferred: false,
    currency: null,
    typicalBudget: null,
  }
}

export class ConversationMemoryAdapter {
  /**
   * Adapt preference / long-term memory into soft planning defaults.
   * Does not write persistence — read-only adapter.
   */
  read(input?: {
    preferenceMemory?: Partial<BrainV1PreferenceMemory> | null
    longTerm?: Partial<BrainV1LongTermMemory> | null
  }): ConversationMemorySnapshot {
    const preferenceMemory: BrainV1PreferenceMemory = {
      ...emptyPreferences(),
      ...input?.preferenceMemory,
      preferredAirlines: [
        ...(input?.preferenceMemory?.preferredAirlines
          ?? input?.longTerm?.favoriteAirlines
          ?? input?.longTerm?.preferences?.preferredAirlines
          ?? []),
      ],
      cabinClass:
        input?.preferenceMemory?.cabinClass
        ?? input?.longTerm?.preferences?.cabinClass
        ?? null,
      hotelStarMin:
        input?.preferenceMemory?.hotelStarMin
        ?? input?.longTerm?.preferences?.hotelStarMin
        ?? null,
      currency:
        input?.preferenceMemory?.currency
        ?? input?.longTerm?.profile?.currency
        ?? input?.longTerm?.budgetPreferences?.currency
        ?? null,
      typicalBudget:
        input?.preferenceMemory?.typicalBudget
        ?? input?.longTerm?.budgetPreferences?.typicalAmount
        ?? null,
      maxStops:
        input?.preferenceMemory?.maxStops
        ?? input?.longTerm?.preferences?.maxStops
        ?? null,
      refundablePreferred:
        input?.preferenceMemory?.refundablePreferred
        ?? input?.longTerm?.preferences?.refundablePreferred
        ?? false,
    }

    const softSlotDefaults: Partial<TravelPlanSlots> = {}
    if (preferenceMemory.cabinClass) softSlotDefaults.cabin = preferenceMemory.cabinClass
    if (preferenceMemory.currency) softSlotDefaults.currency = preferenceMemory.currency
    if (preferenceMemory.typicalBudget != null) {
      softSlotDefaults.budget = preferenceMemory.typicalBudget
    }
    if (preferenceMemory.hotelStarMin != null) {
      softSlotDefaults.hotelPreference = `${preferenceMemory.hotelStarMin}-star`
    }

    const longTermNotes: string[] = []
    if (preferenceMemory.preferredAirlines[0]) {
      longTermNotes.push(`preferredAirline=${preferenceMemory.preferredAirlines[0]}`)
    }
    if (preferenceMemory.refundablePreferred) {
      longTermNotes.push('prefersRefundable=true')
    }
    for (const trip of input?.longTerm?.previousTrips ?? []) {
      longTermNotes.push(`previousTrip=${trip.destination}`)
    }

    return { preferenceMemory, longTermNotes, softSlotDefaults }
  }
}

export function createConversationMemoryAdapter(): ConversationMemoryAdapter {
  return new ConversationMemoryAdapter()
}
