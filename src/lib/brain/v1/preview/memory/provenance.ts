/**
 * Sprint 88 Task 3 — Memory provenance metadata (interfaces + pure helpers).
 * No persistence. Maps to AgentMemory.fieldProvenance when applied by adapters.
 */

import {
  provenanced,
  type FieldProvenanceSource,
  type ProvenancedField,
  type RequirementsProvenance,
} from '../../../../agent/fieldProvenance'

export const MEMORY_PROVENANCE_CONTRACT_VERSION = 'sprint88-memory-provenance-1' as const

/** Adapter-level source vocabulary (Architecture ADD §3.3). */
export type MemoryProvenanceSource =
  | 'user_stated'
  | 'assumed'
  | 'provider_sourced'
  | 'preference_default'
  | 'system'

export type MemoryFactProvenance<T = unknown> = {
  field: string
  value: T
  source: MemoryProvenanceSource
  /** 0–1 */
  confidence: number
  updatedAt: string
  /** Trip scope; null for preference / cross-trip facts */
  planId: string | null
  reversible: boolean
}

export type MemoryProvenanceMap = Record<string, MemoryFactProvenance>

/** Map adapter sources onto AgentMemory booking field provenance sources. */
export function toAgentFieldProvenanceSource(
  source: MemoryProvenanceSource,
): FieldProvenanceSource {
  switch (source) {
    case 'user_stated':
      return 'current_turn'
    case 'preference_default':
      return 'confirmed_memory'
    case 'assumed':
    case 'provider_sourced':
    case 'system':
      return 'user_selection'
    default:
      return 'current_turn'
  }
}

export function createMemoryFactProvenance<T>(input: {
  field: string
  value: T
  source: MemoryProvenanceSource
  confidence?: number
  planId?: string | null
  reversible?: boolean
  updatedAt?: string
}): MemoryFactProvenance<T> {
  return {
    field: input.field,
    value: input.value,
    source: input.source,
    confidence: input.confidence ?? (input.source === 'user_stated' ? 1 : 0.7),
    updatedAt: input.updatedAt ?? new Date(0).toISOString(),
    planId: input.planId ?? null,
    reversible: input.reversible ?? input.source === 'assumed',
  }
}

/**
 * Merge a single fact into RequirementsProvenance for AgentMemory.
 * Pure — does not write databases.
 */
export function mergeFactIntoRequirementsProvenance(
  current: RequirementsProvenance | undefined,
  fact: MemoryFactProvenance,
): RequirementsProvenance {
  const key = fact.field as keyof RequirementsProvenance
  const bookingKeys: Array<keyof RequirementsProvenance> = [
    'destination',
    'origin',
    'startDate',
    'endDate',
    'durationDays',
    'travelers',
    'cabinPreference',
  ]
  if (!bookingKeys.includes(key)) return { ...current }

  const field: ProvenancedField<unknown> = provenanced(
    fact.value,
    toAgentFieldProvenanceSource(fact.source),
    fact.confidence,
    fact.source === 'user_stated' || fact.source === 'preference_default',
    fact.source === 'user_stated',
  )

  return {
    ...current,
    [key]: field,
  }
}

/** User correction wins over assumptions (Architecture ADD §3.3). */
export function resolveProvenanceConflict<T>(
  previous: MemoryFactProvenance<T> | undefined,
  next: MemoryFactProvenance<T>,
): MemoryFactProvenance<T> {
  if (!previous) return next
  if (next.source === 'user_stated') return next
  if (previous.source === 'user_stated') return previous
  // Newer timestamp wins when sources are equal priority.
  if (Date.parse(next.updatedAt) >= Date.parse(previous.updatedAt)) return next
  return previous
}
