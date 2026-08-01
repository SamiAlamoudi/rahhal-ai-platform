/**
 * Sprint 88 Task 3 — UserPreferenceAdapter.
 * In-memory preference mapping only. No localStorage / Supabase / DB writes.
 * Soft defaults apply only when working slots are empty (pure helper).
 */

import type { AgentMemory } from '../../../../agent/types'
import { sanitizeMetadata } from '../../../memory/privacy'
import type { BrainV1LongTermMemory, BrainV1PreferenceMemory } from '../../types'
import {
  createMemoryFactProvenance,
  type MemoryFactProvenance,
  type MemoryProvenanceMap,
} from './provenance'

export const USER_PREFERENCE_ADAPTER_VERSION = 'sprint88-user-preference-1' as const

export type UserPreferenceSnapshot = {
  preferences: BrainV1PreferenceMemory
  /** Sanitized view safe for logs / public meta */
  publicView: Record<string, unknown>
  provenance: MemoryProvenanceMap
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

export class UserPreferenceAdapter {
  readonly version = USER_PREFERENCE_ADAPTER_VERSION

  /**
   * Merge partial preference + optional long-term interface into a snapshot.
   * Read-only; does not persist.
   */
  read(input?: {
    preferenceMemory?: Partial<BrainV1PreferenceMemory> | null
    longTerm?: Partial<BrainV1LongTermMemory> | null
  }): UserPreferenceSnapshot {
    const preferences: BrainV1PreferenceMemory = {
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

    const provenance: MemoryProvenanceMap = {}
    const stamp = (field: string, value: unknown) => {
      if (value == null || (Array.isArray(value) && value.length === 0)) return
      provenance[field] = createMemoryFactProvenance({
        field,
        value,
        source: 'preference_default',
        planId: null,
        reversible: true,
        confidence: 0.75,
      })
    }
    stamp('cabinClass', preferences.cabinClass)
    stamp('currency', preferences.currency)
    stamp('typicalBudget', preferences.typicalBudget)
    stamp('hotelStarMin', preferences.hotelStarMin)
    stamp('maxStops', preferences.maxStops)
    stamp('preferredAirlines', preferences.preferredAirlines)
    stamp('refundablePreferred', preferences.refundablePreferred || null)

    return {
      preferences,
      publicView: sanitizeMetadata({
        cabinClass: preferences.cabinClass,
        currency: preferences.currency,
        typicalBudget: preferences.typicalBudget,
        hotelStarMin: preferences.hotelStarMin,
        maxStops: preferences.maxStops,
        preferredAirlines: preferences.preferredAirlines,
        refundablePreferred: preferences.refundablePreferred,
        // Ensure sensitive keys would be redacted if present
        passportNumber: undefined,
      }),
      provenance,
    }
  }

  /**
   * Apply soft preference defaults only into empty working fields.
   * Pure — does not wipe trip slots; does not persist.
   */
  applySoftDefaults(
    memory: AgentMemory,
    preferences: BrainV1PreferenceMemory,
  ): { memory: AgentMemory; applied: string[] } {
    const requirements = { ...memory.requirements }
    const applied: string[] = []

    if (!requirements.cabinPreference && preferences.cabinClass) {
      requirements.cabinPreference = preferences.cabinClass
      applied.push('cabinPreference')
    }
    if (!requirements.budgetCurrency && preferences.currency) {
      requirements.budgetCurrency = preferences.currency
      applied.push('budgetCurrency')
    }
    if (requirements.budgetAmount == null && preferences.typicalBudget != null) {
      requirements.budgetAmount = preferences.typicalBudget
      applied.push('budgetAmount')
    }
    if (!requirements.hotelPreference && preferences.hotelStarMin != null) {
      requirements.hotelPreference = `${preferences.hotelStarMin}-star`
      applied.push('hotelPreference')
    }
    if (!requirements.preferredAirline && preferences.preferredAirlines[0]) {
      requirements.preferredAirline = preferences.preferredAirlines[0]
      applied.push('preferredAirline')
    }

    return {
      memory: applied.length ? { ...memory, requirements } : memory,
      applied,
    }
  }

  /** Provenance facts for fields soft-applied (in-memory metadata only). */
  provenanceForApplied(
    applied: string[],
    preferences: BrainV1PreferenceMemory,
  ): MemoryFactProvenance[] {
    const out: MemoryFactProvenance[] = []
    for (const field of applied) {
      let value: unknown = null
      if (field === 'cabinPreference') value = preferences.cabinClass
      else if (field === 'budgetCurrency') value = preferences.currency
      else if (field === 'budgetAmount') value = preferences.typicalBudget
      else if (field === 'hotelPreference' && preferences.hotelStarMin != null) {
        value = `${preferences.hotelStarMin}-star`
      } else if (field === 'preferredAirline') value = preferences.preferredAirlines[0]
      out.push(
        createMemoryFactProvenance({
          field,
          value,
          source: 'preference_default',
          planId: null,
          reversible: true,
          confidence: 0.75,
        }),
      )
    }
    return out
  }
}

export function createUserPreferenceAdapter(): UserPreferenceAdapter {
  return new UserPreferenceAdapter()
}
