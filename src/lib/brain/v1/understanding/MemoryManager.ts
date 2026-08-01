/**
 * Sprint 89 Phase 1 — Understanding MemoryManager facade.
 * Wires Sprint 88 Working / Preference / Trip adapters for preview/test paths.
 * AgentMemory remains source of truth. No DB persistence. No search.
 *
 * Never silently promotes assumptions to confirmed facts.
 */

import type { AgentMemory } from '../../../agent/types'
import type { BrainV1PreferenceMemory } from '../types'
import {
  createTripMemoryAdapter,
  createUserPreferenceAdapter,
  createWorkingMemoryAdapter,
  type MemoryFactProvenance,
  type MemoryProvenanceMap,
  type TripMemoryAdapter,
  type UserPreferenceAdapter,
  type WorkingMemoryAdapter,
  type WorkingSlotPatch,
} from '../preview/memory'
import type { ExtractedEntityFact } from './types'

export const UNDERSTANDING_MEMORY_MANAGER_VERSION = 'sprint89-phase1-memory-1' as const

export type UnderstandingMemorySnapshot = {
  version: typeof UNDERSTANDING_MEMORY_MANAGER_VERSION
  working: ReturnType<WorkingMemoryAdapter['read']>
  preferences: ReturnType<UserPreferenceAdapter['read']>
  trip: ReturnType<TripMemoryAdapter['read']>
  provenance: MemoryProvenanceMap
}

export type UnderstandingMemoryApplyResult = {
  memory: AgentMemory
  provenance: MemoryProvenanceMap
  applied: MemoryFactProvenance[]
  rejected: Array<{ field: string; reason: string }>
}

function factToSlotPatch(facts: ExtractedEntityFact[]): WorkingSlotPatch {
  const patch: WorkingSlotPatch = {}
  for (const fact of facts) {
    switch (fact.field) {
      case 'destination':
        if (fact.value != null) patch.destination = String(fact.value)
        break
      case 'origin':
        if (fact.value != null) patch.origin = String(fact.value)
        break
      case 'travelDates.start':
        // Allow null clears on correction.
        patch.startDate = (fact.value as string | null) ?? null
        break
      case 'travelDates.end':
        patch.endDate = (fact.value as string | null) ?? null
        break
      case 'adults':
      case 'travelerCount':
        if (typeof fact.value === 'number') patch.travelers = fact.value
        break
      case 'children':
        if (typeof fact.value === 'number') patch.children = fact.value
        break
      case 'budget':
        if (typeof fact.value === 'number') patch.budgetAmount = fact.value
        break
      case 'currency':
        if (fact.value != null) patch.budgetCurrency = String(fact.value)
        break
      case 'cabinClass':
        if (fact.value != null) patch.cabinPreference = String(fact.value)
        break
      default:
        break
    }
  }
  return patch
}

function preferenceMemoryFromAgent(memory: AgentMemory): Partial<BrainV1PreferenceMemory> {
  const req = memory.requirements
  return {
    cabinClass: req.cabinPreference,
    currency: req.budgetCurrency,
    typicalBudget: req.budgetAmount,
    preferredAirlines: req.preferredAirline ? [req.preferredAirline] : [],
    hotelStarMin: null,
    maxStops: null,
    refundablePreferred: false,
  }
}

export class UnderstandingMemoryManager {
  readonly version = UNDERSTANDING_MEMORY_MANAGER_VERSION
  private readonly working: WorkingMemoryAdapter
  private readonly preferences: UserPreferenceAdapter
  private readonly trip: TripMemoryAdapter
  private provenance: MemoryProvenanceMap = {}

  constructor(deps?: {
    working?: WorkingMemoryAdapter
    preferences?: UserPreferenceAdapter
    trip?: TripMemoryAdapter
  }) {
    this.working = deps?.working ?? createWorkingMemoryAdapter()
    this.preferences = deps?.preferences ?? createUserPreferenceAdapter()
    this.trip = deps?.trip ?? createTripMemoryAdapter()
  }

  read(memory: AgentMemory): UnderstandingMemorySnapshot {
    return {
      version: this.version,
      working: this.working.read(memory, this.provenance),
      preferences: this.preferences.read({
        preferenceMemory: preferenceMemoryFromAgent(memory),
      }),
      trip: this.trip.read(memory),
      provenance: { ...this.provenance },
    }
  }

  /**
   * Apply user/inferred/corrected entity facts into AgentMemory via WorkingMemoryAdapter.
   * Rejects assumption→confirmed promotion and defers bare assumptions to Phase 2.
   * Abort mode is a pure no-op that preserves confirmed memories.
   */
  applyEntityFacts(
    memory: AgentMemory,
    facts: ExtractedEntityFact[],
    options?: {
      planId?: string | null
      updatedAt?: string
      /** When true, leave memory + provenance untouched (cancel/abort intent). */
      preserveOnAbort?: boolean
    },
  ): UnderstandingMemoryApplyResult {
    const applied: MemoryFactProvenance[] = []
    const rejected: Array<{ field: string; reason: string }> = []

    if (options?.preserveOnAbort) {
      return {
        memory,
        provenance: { ...this.provenance },
        applied,
        rejected: facts.map((f) => ({ field: f.field, reason: 'abort_preserves_memory' })),
      }
    }

    const accepted: ExtractedEntityFact[] = []
    for (const fact of facts) {
      if (fact.kind === 'assumption' && fact.confidence.level === 'confirmed') {
        rejected.push({
          field: fact.field,
          reason: 'INTERNAL_CONTRACT_VIOLATION:assumption_as_confirmed',
        })
        continue
      }
      if (fact.kind === 'assumption') {
        rejected.push({ field: fact.field, reason: 'assumption_deferred_to_phase2' })
        continue
      }
      accepted.push(fact)
    }

    const patch = factToSlotPatch(accepted)
    if (Object.keys(patch).length === 0) {
      return { memory, provenance: { ...this.provenance }, applied, rejected }
    }

    // Capture prior slot values before any invalidation (for correction provenance).
    const priorSlotValues: Record<string, unknown> = {
      destination: memory.requirements.destination,
      origin: memory.requirements.origin,
      startDate: memory.requirements.startDate,
      endDate: memory.requirements.endDate,
      travelers: memory.requirements.travelers,
      children: memory.requirements.children,
      budgetAmount: memory.requirements.budgetAmount,
      budgetCurrency: memory.requirements.budgetCurrency,
      cabinPreference: memory.requirements.cabinPreference,
    }
    const priorProvenanceSnapshot = { ...this.provenance }

    // Destination change invalidates prior trip-scoped offers/selections (not traveler prefs).
    let base = memory
    if (
      patch.destination
      && memory.requirements.destination
      && patch.destination !== memory.requirements.destination
    ) {
      const invalidated = this.trip.invalidateForNewTrip(memory, null, {
        priorProvenance: this.provenance,
      })
      base = invalidated.memory
      // Keep non-trip provenance; destination rewritten below with correction metadata.
      this.provenance = invalidated.provenance
    }

    const scores = accepted.map((f) => f.confidence.score ?? 0.7)
    const confidence = scores.length ? Math.min(...scores) : 0.7
    const updatedAt = options?.updatedAt ?? new Date().toISOString()

    const result = this.working.applyIncremental(base, patch, {
      source: 'user_stated',
      planId: options?.planId ?? base.tripPlan?.id ?? null,
      confidence,
      updatedAt,
      priorProvenance: this.provenance,
    })

    // Annotate corrections with previousValue for provenance integrity.
    for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
      const nextFact = result.provenance[key]
      if (!nextFact) continue
      const previousValue =
        priorProvenanceSnapshot[key]?.value ?? priorSlotValues[key] ?? undefined
      const changed =
        previousValue !== undefined
        && previousValue !== null
        && previousValue !== ''
        && previousValue !== nextFact.value
      result.provenance[key] = {
        ...nextFact,
        source: 'user_stated',
        reversible: false,
        updatedAt,
        ...(changed ? { previousValue, corrected: true } : {}),
      }
    }

    this.provenance = result.provenance
    for (const key of Object.keys(patch)) {
      const fact = result.provenance[key]
      if (fact) applied.push(fact)
    }

    return {
      memory: result.memory,
      provenance: { ...this.provenance },
      applied,
      rejected,
    }
  }

  /** Soft preference defaults into empty slots only — never overwrites user facts. */
  applyPreferenceDefaults(
    memory: AgentMemory,
    preferences?: BrainV1PreferenceMemory,
  ): AgentMemory {
    const prefs =
      preferences
      ?? this.preferences.read({ preferenceMemory: preferenceMemoryFromAgent(memory) }).preferences
    return this.preferences.applySoftDefaults(memory, prefs).memory
  }

  getProvenance(): MemoryProvenanceMap {
    return { ...this.provenance }
  }

  replaceProvenance(map: MemoryProvenanceMap): void {
    this.provenance = { ...map }
  }
}

export function createUnderstandingMemoryManager(deps?: {
  working?: WorkingMemoryAdapter
  preferences?: UserPreferenceAdapter
  trip?: TripMemoryAdapter
}): UnderstandingMemoryManager {
  return new UnderstandingMemoryManager(deps)
}
