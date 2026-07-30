/**
 * Strict field provenance for booking-critical trip slots.
 * Search may start only when mandatory fields are confirmed with valid source.
 */

export type FieldProvenanceSource = 'current_turn' | 'confirmed_memory' | 'user_selection'

export type ProvenancedField<T> = {
  value: T
  source: FieldProvenanceSource
  confidence: number
  confirmed: boolean
}

export type RequirementsProvenance = {
  destination?: ProvenancedField<string | null>
  origin?: ProvenancedField<string | null>
  startDate?: ProvenancedField<string | null>
  endDate?: ProvenancedField<string | null>
  durationDays?: ProvenancedField<number | null>
  travelers?: ProvenancedField<number | null>
  cabinPreference?: ProvenancedField<string | null>
}

const VALID_SOURCES = new Set<FieldProvenanceSource>([
  'current_turn',
  'confirmed_memory',
  'user_selection',
])

export function provenanced<T>(
  value: T,
  source: FieldProvenanceSource,
  confidence = 1,
  confirmed = true,
): ProvenancedField<T> {
  return { value, source, confidence, confirmed }
}

/** True when a mandatory field may drive search / cards. */
export function isSearchReadyField<T>(
  field: ProvenancedField<T> | null | undefined,
): boolean {
  if (!field) return false
  if (!field.confirmed) return false
  if (!VALID_SOURCES.has(field.source)) return false
  if (field.confidence < 0.8) return false
  const v = field.value
  if (v == null) return false
  if (typeof v === 'string' && !v.trim()) return false
  if (typeof v === 'number' && !(v > 0)) return false
  return true
}

export function bookingFieldsSearchReady(provenance: RequirementsProvenance | null | undefined): {
  ready: boolean
  missing: Array<keyof RequirementsProvenance>
} {
  const missing: Array<keyof RequirementsProvenance> = []
  if (!isSearchReadyField(provenance?.destination)) missing.push('destination')
  const hasDates = isSearchReadyField(provenance?.durationDays)
    || (isSearchReadyField(provenance?.startDate) && isSearchReadyField(provenance?.endDate))
    || isSearchReadyField(provenance?.startDate)
  if (!hasDates) missing.push('durationDays')
  if (!isSearchReadyField(provenance?.travelers)) missing.push('travelers')
  return { ready: missing.length === 0, missing }
}

/**
 * Build provenance for the current turn merge.
 * Stale traveler counts from a prior destination/trip are never marked confirmed.
 */
export function buildRequirementsProvenance(input: {
  patch: {
    destination?: string | null
    origin?: string | null
    startDate?: string | null
    endDate?: string | null
    durationDays?: number | null
    travelers?: number | null
    cabinPreference?: string | null
  }
  merged: {
    destination?: string | null
    origin?: string | null
    startDate?: string | null
    endDate?: string | null
    durationDays?: number | null
    travelers?: number | null
    cabinPreference?: string | null
  }
  prior?: RequirementsProvenance | null
  destinationChanged?: boolean
}): RequirementsProvenance {
  const { patch, merged, prior, destinationChanged } = input
  const out: RequirementsProvenance = {}

  if (merged.destination) {
    out.destination = patch.destination
      ? provenanced(merged.destination, 'current_turn', 1, true)
      : (prior?.destination?.confirmed
        ? provenanced(merged.destination, 'confirmed_memory', prior.destination.confidence, true)
        : provenanced(merged.destination, 'current_turn', 0.9, true))
  }

  if (merged.origin) {
    out.origin = patch.origin
      ? provenanced(merged.origin, 'current_turn', 1, true)
      : (prior?.origin?.confirmed
        ? provenanced(merged.origin, 'confirmed_memory', prior.origin.confidence, true)
        : undefined)
  }

  if (merged.startDate) {
    out.startDate = patch.startDate
      ? provenanced(merged.startDate, 'current_turn', 1, true)
      : (prior?.startDate?.confirmed
        ? provenanced(merged.startDate, 'confirmed_memory', prior.startDate.confidence, true)
        : undefined)
  }

  if (merged.endDate) {
    out.endDate = patch.endDate
      ? provenanced(merged.endDate, 'current_turn', 1, true)
      : (prior?.endDate?.confirmed
        ? provenanced(merged.endDate, 'confirmed_memory', prior.endDate.confidence, true)
        : undefined)
  }

  if (merged.durationDays != null) {
    out.durationDays = patch.durationDays != null
      ? provenanced(merged.durationDays, 'current_turn', 1, true)
      : (prior?.durationDays?.confirmed
        ? provenanced(merged.durationDays, 'confirmed_memory', prior.durationDays.confidence, true)
        : provenanced(merged.durationDays, 'current_turn', 0.9, true))
  }

  // Travelers: never inherit across destination changes; never invent.
  if (destinationChanged && patch.travelers == null) {
    out.travelers = provenanced(null, 'current_turn', 0, false)
  } else if (patch.travelers != null && patch.travelers > 0) {
    out.travelers = provenanced(patch.travelers, 'current_turn', 1, true)
  } else if (
    !destinationChanged
    && prior?.travelers?.confirmed
    && prior.travelers.value != null
    && merged.travelers === prior.travelers.value
  ) {
    out.travelers = provenanced(merged.travelers, 'confirmed_memory', prior.travelers.confidence, true)
  } else if (merged.travelers != null) {
    // Present in memory without valid provenance → unconfirmed (block search).
    out.travelers = provenanced(merged.travelers, 'current_turn', 0.3, false)
  } else {
    out.travelers = provenanced(null, 'current_turn', 0, false)
  }

  if (merged.cabinPreference) {
    out.cabinPreference = patch.cabinPreference
      ? provenanced(merged.cabinPreference, 'current_turn', 1, true)
      : (prior?.cabinPreference?.confirmed
        ? provenanced(merged.cabinPreference, 'confirmed_memory', prior.cabinPreference.confidence, true)
        : undefined)
  }

  return out
}
