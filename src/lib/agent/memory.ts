/**
 * Conversation intake memory helpers used by `travelAgentService.planTurn`.
 *
 * Recovery Phase 1 — ONE memory pipeline for product turns:
 * `rebuildMemoryFromMessages` in this file (+ preference seeding via `ai.persistent_memory`).
 *
 * Sprint 112 Memory Engine under `./memory/` is quarantined (flag OFF). See `./memory/DEPRECATION.md`.
 */
import type { ChatMessage } from '../chat/chatTypes'
import type { AgentMemory, AgentProviderMeta, TripPlan, TripRequirements } from './types'
import { emptyMemory, emptyRequirements, INTAKE_FIELD_ORDER, withTripPlan } from './types'
import {
  inferSoftRequirements,
  isSmartClarificationEnabled,
  missingClarificationFields,
} from './clarification'

export function isAgentProviderMeta(value: unknown): value is AgentProviderMeta {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return row.kind === 'travel_agent'
    && (row.version === 1 || row.version === 2)
    && !!row.memory
}

export function tripPlanFromMeta(meta: Record<string, unknown> | null | undefined): TripPlan | null {
  if (!isAgentProviderMeta(meta)) return null
  return meta.tripPlan ?? meta.itinerary ?? meta.memory.tripPlan ?? meta.memory.itinerary ?? null
}

export function memoryFromMeta(meta: Record<string, unknown> | null | undefined): AgentMemory | null {
  if (!isAgentProviderMeta(meta)) return null
  const raw = meta.memory
  const plan = raw.tripPlan ?? raw.itinerary ?? meta.tripPlan ?? meta.itinerary ?? null
  const requirements = normalizeRequirements(raw.requirements ?? emptyRequirements())
  return withTripPlan({
    ...raw,
    requirements,
    tripPlan: plan,
    itinerary: plan,
  }, plan)
}

export function mergeRequirements(
  base: TripRequirements,
  patch: Partial<TripRequirements>,
  options?: { replaceDestinations?: boolean },
): TripRequirements {
  // Latest confirmed named destination always wins over stale/demo/prior-session places.
  const patchNamesDestination = Boolean(
    (patch.destination && patch.destination.trim())
    || (patch.destinations && patch.destinations.length > 0),
  )
  const replaceDestinations = options?.replaceDestinations === true || patchNamesDestination

  const destinations = patch.destinations && patch.destinations.length > 0
    ? (replaceDestinations
      ? uniqueStrings(patch.destinations)
      : uniqueStrings([...base.destinations, ...patch.destinations]))
    : (replaceDestinations && patch.destination
      ? uniqueStrings([patch.destination])
      : base.destinations)

  const destination = patch.destination ?? (replaceDestinations ? null : base.destination) ?? destinations[0] ?? null
  const interests = patch.interests && patch.interests.length > 0
    ? uniqueStrings([...base.interests, ...patch.interests])
    : base.interests

  // New destination / trip → never reuse stale party size, dates, cabin, or origin.
  const clearStaleTrip = Boolean(
    replaceDestinations
    && patch.destination
    && patch.destination !== base.destination,
  )

  const merged: TripRequirements = {
    destination,
    destinations: destination && !destinations.includes(destination)
      ? [destination, ...destinations]
      : destinations.length > 0
        ? destinations
        : destination
          ? [destination]
          : [],
    destinationCity: patch.destinationCity ?? (replaceDestinations ? null : base.destinationCity) ?? null,
    destinationCountry: patch.destinationCountry ?? (replaceDestinations ? null : base.destinationCountry) ?? null,
    destinationFlexible: patch.destinationFlexible ?? base.destinationFlexible,
    origin: clearStaleTrip
      ? (patch.origin ?? null)
      : (patch.origin ?? base.origin),
    startDate: clearStaleTrip
      ? (patch.startDate ?? null)
      : (patch.startDate ?? base.startDate),
    endDate: clearStaleTrip
      ? (patch.endDate ?? null)
      : (patch.endDate ?? base.endDate),
    durationDays: clearStaleTrip
      ? (patch.durationDays ?? null)
      : (patch.durationDays ?? base.durationDays),
    travelers: clearStaleTrip && patch.travelers === undefined
      ? null
      : (patch.travelers ?? (clearStaleTrip ? null : base.travelers)),
    travelerType: clearStaleTrip
      ? (patch.travelerType ?? null)
      : (patch.travelerType ?? base.travelerType),
    budgetAmount: patch.budgetAmount ?? base.budgetAmount,
    budgetCurrency: patch.budgetCurrency ?? base.budgetCurrency,
    budgetFlexible: patch.budgetFlexible ?? base.budgetFlexible,
    budgetStyle: patch.budgetStyle ?? base.budgetStyle,
    hotelPreference: patch.hotelPreference ?? base.hotelPreference,
    packageScope: patch.packageScope ?? base.packageScope,
    weatherPreference: patch.weatherPreference ?? base.weatherPreference,
    interests,
    notes: patch.notes ?? base.notes,
    tripPurpose: patch.tripPurpose ?? base.tripPurpose,
    regenerateDay: patch.regenerateDay ?? null,
    regenerateScope: patch.regenerateScope ?? base.regenerateScope ?? null,
    cabinPreference: clearStaleTrip
      ? (patch.cabinPreference ?? null)
      : (patch.cabinPreference ?? base.cabinPreference ?? null),
    children: patch.children ?? base.children ?? null,
    preferredAirline: patch.preferredAirline ?? base.preferredAirline ?? null,
    preferredDepartureTime: patch.preferredDepartureTime ?? base.preferredDepartureTime ?? null,
    datesFlexible: patch.datesFlexible ?? base.datesFlexible ?? null,
    travelerTimezone: patch.travelerTimezone ?? base.travelerTimezone ?? null,
    rooms: patch.rooms ?? base.rooms ?? null,
    preferredArea: patch.preferredArea ?? base.preferredArea ?? null,
    breakfastRequired: patch.breakfastRequired ?? base.breakfastRequired ?? null,
    freeCancellationRequired: patch.freeCancellationRequired ?? base.freeCancellationRequired ?? null,
    hotelAmenities: patch.hotelAmenities && patch.hotelAmenities.length > 0
      ? uniqueStrings([...(base.hotelAmenities ?? []), ...patch.hotelAmenities])
      : (base.hotelAmenities ?? []),
  }

  // Locking a named destination clears flexible discovery.
  if (patch.destination && patch.destinationFlexible !== true) {
    merged.destinationFlexible = false
  }

  // Infer traveler type from count when still unset — never invent count from type
  // (couple/family must not silently become 2/4).
  if (merged.travelerType == null && merged.travelers != null) {
    if (merged.travelers === 1) merged.travelerType = 'solo'
    else if (merged.travelers === 2) merged.travelerType = 'couple'
    else if (merged.travelers >= 3) merged.travelerType = 'family'
  }
  // Solo is an explicit party-size word; couple/family are not.
  if (merged.travelers == null && merged.travelerType === 'solo') merged.travelers = 1

  return merged
}

export function missingRequirementFields(
  requirements: TripRequirements,
  options: { smart?: boolean } = {},
): Array<keyof TripRequirements> {
  const smart = typeof options.smart === 'boolean'
    ? options.smart
    : isSmartClarificationEnabled()

  if (smart) {
    // Infer soft slots first so planning never blocks on form-style preferences.
    const inferred = inferSoftRequirements(requirements).requirements
    return missingClarificationFields(inferred, { smart: true })
  }

  // Legacy full intake (flag off) — keep soft slots blocking.
  const req = normalizeRequirements(requirements)
  const missing: Array<keyof TripRequirements> = []

  for (const field of INTAKE_FIELD_ORDER) {
    if (field === 'destination') {
      // Sprint 45 — open-ended discovery: destination is proposed by reasoning, not asked.
      if (req.destinationFlexible) continue
      if (!req.destination && req.destinations.length === 0) missing.push('destination')
      continue
    }
    if (field === 'durationDays') {
      if (req.durationDays == null && (!req.startDate || !req.endDate)) {
        missing.push('durationDays')
      }
      continue
    }
    if (field === 'budgetAmount') {
      if (req.budgetAmount == null && req.budgetFlexible !== true) missing.push('budgetAmount')
      continue
    }
    if (field === 'travelers') {
      if (req.travelers == null) missing.push('travelers')
      continue
    }
    if (field === 'travelerType') {
      if (req.travelerType == null) missing.push('travelerType')
      continue
    }
    if (field === 'interests') {
      if (req.interests.length === 0) missing.push('interests')
      continue
    }
    if (field === 'weatherPreference') {
      if (!req.weatherPreference) missing.push('weatherPreference')
      continue
    }
    if (field === 'budgetStyle') {
      if (!req.budgetStyle) missing.push('budgetStyle')
      continue
    }
    if (field === 'hotelPreference') {
      if (!req.hotelPreference) missing.push('hotelPreference')
      continue
    }
    if (field === 'packageScope') {
      if (!req.packageScope) missing.push('packageScope')
    }
  }

  return missing
}

/**
 * Apply never-ask-twice soft inference onto requirements (mutates via return).
 * Call before planning / tool selection so defaults are concrete.
 */
export function applySmartClarification(
  requirements: TripRequirements,
  options: { locale?: AgentMemory['locale']; enabled?: boolean } = {},
): { requirements: TripRequirements; inferred: Array<keyof TripRequirements>; rationale: string[] } {
  if (!isSmartClarificationEnabled({ enabled: options.enabled })) {
    return { requirements, inferred: [], rationale: [] }
  }
  return inferSoftRequirements(requirements, { locale: options.locale })
}

/** Next single intake question for conversational flow. */
export function nextMissingIntakeField(
  requirements: TripRequirements,
): keyof TripRequirements | null {
  return missingRequirementFields(requirements)[0] ?? null
}

export function rebuildMemoryFromMessages(
  messages: ChatMessage[],
  fallbackLocale: AgentMemory['locale'] = 'ar',
): AgentMemory {
  let memory = emptyMemory(fallbackLocale)
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    const fromMeta = memoryFromMeta(message.providerMeta)
    if (fromMeta) memory = fromMeta
  }
  if (!memory.requirements) memory.requirements = emptyRequirements()
  memory.requirements = normalizeRequirements(memory.requirements)
  memory.missingFields = missingRequirementFields(memory.requirements)
  memory = withTripPlan(memory, memory.tripPlan ?? memory.itinerary)
  return memory
}

/** Normalize older saved memory rows that predate Phase L fields. */
export function normalizeRequirements(raw: TripRequirements): TripRequirements {
  return {
    ...emptyRequirements(),
    ...raw,
    destinations: Array.isArray(raw.destinations) ? raw.destinations : [],
    interests: Array.isArray(raw.interests) ? raw.interests : [],
    destinationCity: raw.destinationCity ?? null,
    destinationCountry: raw.destinationCountry ?? null,
    destinationFlexible: raw.destinationFlexible ?? null,
    budgetFlexible: raw.budgetFlexible ?? null,
    budgetStyle: raw.budgetStyle ?? null,
    hotelPreference: raw.hotelPreference ?? null,
    packageScope: raw.packageScope ?? null,
    weatherPreference: raw.weatherPreference ?? null,
    regenerateDay: raw.regenerateDay ?? null,
    regenerateScope: raw.regenerateScope ?? null,
    cabinPreference: raw.cabinPreference ?? null,
    children: raw.children ?? null,
    preferredAirline: raw.preferredAirline ?? null,
    preferredDepartureTime: raw.preferredDepartureTime ?? null,
    datesFlexible: raw.datesFlexible ?? null,
    travelerTimezone: raw.travelerTimezone ?? null,
    rooms: raw.rooms ?? null,
    preferredArea: raw.preferredArea ?? null,
    breakfastRequired: raw.breakfastRequired ?? null,
    freeCancellationRequired: raw.freeCancellationRequired ?? null,
    hotelAmenities: Array.isArray(raw.hotelAmenities) ? raw.hotelAmenities : [],
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}
