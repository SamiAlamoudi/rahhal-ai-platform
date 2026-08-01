/**
 * Sprint 88 Task 3 — WorkingMemoryAdapter.
 * Maps working slots ↔ AgentMemory (source of truth). No persistence.
 * Not wired into BrainRouter / planTurn in this task.
 */

import type { AgentMemory, TripRequirements } from '../../../../agent/types'
import {
  createMemoryFactProvenance,
  mergeFactIntoRequirementsProvenance,
  resolveProvenanceConflict,
  type MemoryFactProvenance,
  type MemoryProvenanceMap,
  type MemoryProvenanceSource,
} from './provenance'

export const WORKING_MEMORY_ADAPTER_VERSION = 'sprint88-working-memory-1' as const

export type WorkingSlotKey =
  | 'destination'
  | 'origin'
  | 'startDate'
  | 'endDate'
  | 'durationDays'
  | 'travelers'
  | 'children'
  | 'budgetAmount'
  | 'budgetCurrency'
  | 'cabinPreference'
  | 'hotelPreference'
  | 'tripPurpose'

export type WorkingSlotPatch = Partial<
  Pick<
    TripRequirements,
    | 'destination'
    | 'origin'
    | 'startDate'
    | 'endDate'
    | 'durationDays'
    | 'travelers'
    | 'children'
    | 'budgetAmount'
    | 'budgetCurrency'
    | 'cabinPreference'
    | 'hotelPreference'
    | 'tripPurpose'
  >
>

export type WorkingMemorySnapshot = {
  locale: AgentMemory['locale']
  phase: AgentMemory['phase']
  planId: string | null
  slots: WorkingSlotPatch
  missingFields: Array<keyof TripRequirements>
  lastIntent: AgentMemory['lastIntent']
  provenance: MemoryProvenanceMap
}

export type WorkingMemoryApplyOptions = {
  source?: MemoryProvenanceSource
  planId?: string | null
  confidence?: number
  updatedAt?: string
  /** Prior adapter provenance map (in-memory only). */
  priorProvenance?: MemoryProvenanceMap
}

function slotsFromRequirements(req: TripRequirements): WorkingSlotPatch {
  return {
    destination: req.destination,
    origin: req.origin,
    startDate: req.startDate,
    endDate: req.endDate,
    durationDays: req.durationDays,
    travelers: req.travelers,
    children: req.children,
    budgetAmount: req.budgetAmount,
    budgetCurrency: req.budgetCurrency,
    cabinPreference: req.cabinPreference,
    hotelPreference: req.hotelPreference,
    tripPurpose: req.tripPurpose,
  }
}

export class WorkingMemoryAdapter {
  readonly version = WORKING_MEMORY_ADAPTER_VERSION

  /** Read-only snapshot from AgentMemory. */
  read(memory: AgentMemory, provenance: MemoryProvenanceMap = {}): WorkingMemorySnapshot {
    return {
      locale: memory.locale,
      phase: memory.phase,
      planId: memory.tripPlan?.id ?? null,
      slots: slotsFromRequirements(memory.requirements),
      missingFields: [...memory.missingFields],
      lastIntent: memory.lastIntent,
      provenance: { ...provenance },
    }
  }

  /**
   * Incremental slot update — never wipes unrelated slots.
   * Returns a new AgentMemory; does not mutate input; no I/O.
   */
  applyIncremental(
    memory: AgentMemory,
    patch: WorkingSlotPatch,
    options: WorkingMemoryApplyOptions = {},
  ): { memory: AgentMemory; provenance: MemoryProvenanceMap } {
    const source = options.source ?? 'user_stated'
    const planId = options.planId ?? memory.tripPlan?.id ?? null
    const updatedAt = options.updatedAt ?? new Date(0).toISOString()
    const provenance: MemoryProvenanceMap = { ...(options.priorProvenance ?? {}) }

    const requirements: TripRequirements = { ...memory.requirements }
    let fieldProvenance = memory.fieldProvenance ? { ...memory.fieldProvenance } : undefined

    const assign = (key: WorkingSlotKey, rawValue: unknown) => {
      if (rawValue === undefined) return
      switch (key) {
        case 'destination':
          requirements.destination = rawValue as string | null
          if (typeof rawValue === 'string' && rawValue.trim()) {
            requirements.destinations = [rawValue]
          }
          break
        case 'origin':
          requirements.origin = rawValue as string | null
          break
        case 'startDate':
          requirements.startDate = rawValue as string | null
          break
        case 'endDate':
          requirements.endDate = rawValue as string | null
          break
        case 'durationDays':
          requirements.durationDays = rawValue as number | null
          break
        case 'travelers':
          requirements.travelers = rawValue as number | null
          break
        case 'children':
          requirements.children = rawValue as number | null
          break
        case 'budgetAmount':
          requirements.budgetAmount = rawValue as number | null
          break
        case 'budgetCurrency':
          requirements.budgetCurrency = rawValue as string | null
          break
        case 'cabinPreference':
          requirements.cabinPreference = rawValue as string | null
          break
        case 'hotelPreference':
          requirements.hotelPreference = rawValue as string | null
          break
        case 'tripPurpose':
          requirements.tripPurpose = rawValue as TripRequirements['tripPurpose']
          break
        default:
          break
      }

      const fact = createMemoryFactProvenance({
        field: key,
        value: rawValue,
        source,
        confidence: options.confidence,
        planId,
        updatedAt,
        reversible: source === 'assumed',
      })
      const resolved = resolveProvenanceConflict(
        provenance[key] as MemoryFactProvenance | undefined,
        fact,
      )
      provenance[key] = resolved
      fieldProvenance = mergeFactIntoRequirementsProvenance(fieldProvenance, resolved)
    }

    for (const key of Object.keys(patch) as WorkingSlotKey[]) {
      assign(key, patch[key])
    }

    return {
      memory: {
        ...memory,
        requirements,
        fieldProvenance,
      },
      provenance,
    }
  }
}

export function createWorkingMemoryAdapter(): WorkingMemoryAdapter {
  return new WorkingMemoryAdapter()
}
