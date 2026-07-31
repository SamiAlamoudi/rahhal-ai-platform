/**
 * Strict field provenance for booking-critical trip slots.
 * Search may start only when mandatory fields are confirmed with valid source.
 * Current-turn values always outrank confirmed_memory / stale trip state.
 */

export type FieldProvenanceSource = 'current_turn' | 'confirmed_memory' | 'user_selection'

export type ProvenancedField<T> = {
  value: T
  source: FieldProvenanceSource
  /** 0–1 confidence */
  confidence: number
  confirmed: boolean
  /** True when the value was set or refreshed by the current user turn. */
  currentTurnPriority: boolean
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
  currentTurnPriority = source === 'current_turn',
): ProvenancedField<T> {
  return { value, source, confidence, confirmed, currentTurnPriority }
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

/**
 * Booking search / cards require confirmed destination, travelers,
 * calendar dates (start + end), and origin — never duration alone,
 * and never invented defaults.
 */
export function bookingFieldsSearchReady(provenance: RequirementsProvenance | null | undefined): {
  ready: boolean
  missing: Array<keyof RequirementsProvenance>
} {
  const missing: Array<keyof RequirementsProvenance> = []
  if (!isSearchReadyField(provenance?.destination)) missing.push('destination')
  if (!isSearchReadyField(provenance?.travelers)) missing.push('travelers')
  if (!isSearchReadyField(provenance?.startDate)) missing.push('startDate')
  if (!isSearchReadyField(provenance?.endDate)) missing.push('endDate')
  if (!isSearchReadyField(provenance?.origin)) missing.push('origin')
  return { ready: missing.length === 0, missing }
}

/** Next booking question order for voice intake (one at a time). */
export function nextBookingMissingField(
  provenance: RequirementsProvenance | null | undefined,
  requirements: {
    destination?: string | null
    destinations?: string[]
    travelers?: number | null
    startDate?: string | null
    endDate?: string | null
    origin?: string | null
  },
): keyof RequirementsProvenance | null {
  const hasDest = Boolean(
    requirements.destination
    || (requirements.destinations && requirements.destinations.length > 0)
    || isSearchReadyField(provenance?.destination),
  )
  if (!hasDest) return 'destination'
  if (!isSearchReadyField(provenance?.travelers) && requirements.travelers == null) return 'travelers'
  if (!isSearchReadyField(provenance?.startDate) && !requirements.startDate) return 'startDate'
  if (!isSearchReadyField(provenance?.endDate) && !requirements.endDate) return 'endDate'
  if (!isSearchReadyField(provenance?.origin) && !requirements.origin) return 'origin'
  return null
}

function fromPatchOrMemory<T>(input: {
  patchValue: T | null | undefined
  mergedValue: T | null | undefined
  prior?: ProvenancedField<T> | null
  patchPresent: boolean
}): ProvenancedField<T> | undefined {
  const { patchValue, mergedValue, prior, patchPresent } = input
  if (patchPresent && patchValue !== undefined) {
    // Current turn always wins over stale memory.
    const confirmed = patchValue != null && !(typeof patchValue === 'string' && !String(patchValue).trim())
    return provenanced(
      (patchValue ?? null) as T,
      'current_turn',
      confirmed ? 1 : 0,
      Boolean(confirmed),
      true,
    )
  }
  if (mergedValue != null && prior?.confirmed && prior.value === mergedValue) {
    return provenanced(mergedValue, 'confirmed_memory', prior.confidence, true, false)
  }
  if (mergedValue != null) {
    return provenanced(mergedValue, 'confirmed_memory', 0.85, true, false)
  }
  return undefined
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

  const dest = fromPatchOrMemory({
    patchValue: patch.destination,
    mergedValue: merged.destination,
    prior: prior?.destination,
    patchPresent: patch.destination !== undefined && patch.destination != null,
  })
  if (dest) out.destination = dest

  const origin = fromPatchOrMemory({
    patchValue: patch.origin,
    mergedValue: merged.origin,
    prior: prior?.origin,
    patchPresent: patch.origin !== undefined && patch.origin != null,
  })
  if (origin) out.origin = origin

  const startDate = fromPatchOrMemory({
    patchValue: patch.startDate,
    mergedValue: merged.startDate,
    prior: prior?.startDate,
    patchPresent: patch.startDate !== undefined && patch.startDate != null,
  })
  if (startDate) out.startDate = startDate

  const endDate = fromPatchOrMemory({
    patchValue: patch.endDate,
    mergedValue: merged.endDate,
    prior: prior?.endDate,
    patchPresent: patch.endDate !== undefined && patch.endDate != null,
  })
  if (endDate) out.endDate = endDate

  if (patch.durationDays != null) {
    out.durationDays = provenanced(patch.durationDays, 'current_turn', 1, true, true)
  } else if (merged.durationDays != null && prior?.durationDays?.confirmed) {
    out.durationDays = provenanced(merged.durationDays, 'confirmed_memory', prior.durationDays.confidence, true, false)
  } else if (merged.durationDays != null) {
    out.durationDays = provenanced(merged.durationDays, 'confirmed_memory', 0.85, true, false)
  }

  // Travelers: never inherit across destination changes; never invent.
  if (destinationChanged && patch.travelers == null) {
    out.travelers = provenanced(null, 'current_turn', 0, false, true)
  } else if (patch.travelers != null && patch.travelers > 0) {
    out.travelers = provenanced(patch.travelers, 'current_turn', 1, true, true)
  } else if (
    !destinationChanged
    && prior?.travelers?.confirmed
    && prior.travelers.value != null
    && merged.travelers === prior.travelers.value
  ) {
    out.travelers = provenanced(merged.travelers, 'confirmed_memory', prior.travelers.confidence, true, false)
  } else if (merged.travelers != null) {
    out.travelers = provenanced(merged.travelers, 'current_turn', 0.3, false, false)
  } else {
    out.travelers = provenanced(null, 'current_turn', 0, false, true)
  }

  if (destinationChanged && patch.cabinPreference == null) {
    // Drop stale cabin from prior trip.
    out.cabinPreference = provenanced(null, 'current_turn', 0, false, true)
  } else if (patch.cabinPreference) {
    out.cabinPreference = provenanced(patch.cabinPreference, 'current_turn', 1, true, true)
  } else if (merged.cabinPreference && prior?.cabinPreference?.confirmed) {
    out.cabinPreference = provenanced(
      merged.cabinPreference,
      'confirmed_memory',
      prior.cabinPreference.confidence,
      true,
      false,
    )
  }

  return out
}
