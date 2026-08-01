/**
 * Sprint 88 Task 3 — TripMemoryAdapter.
 * Trip-scoped state over AgentMemory.tripPlan. No persistence / DB.
 * New planId invalidates trip offers, selections, and trip-scoped assumptions.
 */

import type { AgentMemory, TripPlan } from '../../../../agent/types'
import type { MemoryFactProvenance, MemoryProvenanceMap } from './provenance'

export const TRIP_MEMORY_ADAPTER_VERSION = 'sprint88-trip-memory-1' as const

export type TripMemorySnapshot = {
  planId: string | null
  tripPlan: TripPlan | null
  selectedBookingOption: AgentMemory['selectedBookingOption']
  /** Offer / decision ids held only in adapter snapshot (not persisted here). */
  offerIds: string[]
  tripAssumptions: MemoryFactProvenance[]
}

export type TripInvalidationResult = {
  memory: AgentMemory
  /** Provenance facts that remain (non-trip / preference). */
  provenance: MemoryProvenanceMap
  cleared: {
    planId: string | null
    selectedBooking: boolean
    tripPlan: boolean
    tripAssumptionCount: number
  }
}

function isTripScopedFact(fact: MemoryFactProvenance, planId: string | null): boolean {
  if (fact.planId != null && planId != null && fact.planId === planId) return true
  if (fact.source === 'provider_sourced') return true
  // Assumed trip fields tied to a plan
  if (fact.planId != null && fact.source === 'assumed') return true
  return false
}

export class TripMemoryAdapter {
  readonly version = TRIP_MEMORY_ADAPTER_VERSION

  read(
    memory: AgentMemory,
    options?: {
      offerIds?: string[]
      tripAssumptions?: MemoryFactProvenance[]
    },
  ): TripMemorySnapshot {
    return {
      planId: memory.tripPlan?.id ?? null,
      tripPlan: memory.tripPlan,
      selectedBookingOption: memory.selectedBookingOption ?? null,
      offerIds: [...(options?.offerIds ?? [])],
      tripAssumptions: [...(options?.tripAssumptions ?? [])],
    }
  }

  /**
   * Start / switch trip: drop trip-specific state; keep working traveler prefs
   * already on requirements. Pure in-memory transform — no DB.
   */
  invalidateForNewTrip(
    memory: AgentMemory,
    newPlanId: string | null,
    options?: {
      priorProvenance?: MemoryProvenanceMap
      tripAssumptions?: MemoryFactProvenance[]
    },
  ): TripInvalidationResult {
    const previousPlanId = memory.tripPlan?.id ?? null
    const prior = options?.priorProvenance ?? {}
    const kept: MemoryProvenanceMap = {}
    let clearedAssumptions = 0

    for (const [key, fact] of Object.entries(prior)) {
      if (isTripScopedFact(fact, previousPlanId)) {
        clearedAssumptions += 1
        continue
      }
      // Preference / user_stated without plan scope survives.
      kept[key] = fact
    }

    for (const fact of options?.tripAssumptions ?? []) {
      if (isTripScopedFact(fact, previousPlanId)) clearedAssumptions += 1
    }

    const clearedSelection = memory.selectedBookingOption != null
    const clearedPlan = memory.tripPlan != null

    const next: AgentMemory = {
      ...memory,
      tripPlan: null,
      itinerary: null,
      selectedBookingOption: null,
    }

    // newPlanId is recorded only when a TripPlan is attached later by callers.
    // Adapter does not fabricate TripPlan rows.
    void newPlanId

    return {
      memory: next,
      provenance: kept,
      cleared: {
        planId: previousPlanId,
        selectedBooking: clearedSelection,
        tripPlan: clearedPlan,
        tripAssumptionCount: clearedAssumptions,
      },
    }
  }

  /** Attach an existing TripPlan object (caller-built). No network/DB. */
  attachTripPlan(memory: AgentMemory, plan: TripPlan): AgentMemory {
    return {
      ...memory,
      tripPlan: plan,
      itinerary: plan,
    }
  }
}

export function createTripMemoryAdapter(): TripMemoryAdapter {
  return new TripMemoryAdapter()
}
