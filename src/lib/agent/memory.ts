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
  const replaceDestinations = options?.replaceDestinations === true

  const destinations = patch.destinations && patch.destinations.length > 0
    ? (replaceDestinations
      ? uniqueStrings(patch.destinations)
      : uniqueStrings([...base.destinations, ...patch.destinations]))
    : base.destinations

  const destination = patch.destination ?? base.destination ?? destinations[0] ?? null
  const interests = patch.interests && patch.interests.length > 0
    ? uniqueStrings([...base.interests, ...patch.interests])
    : base.interests

  const merged: TripRequirements = {
    destination,
    destinations: destination && !destinations.includes(destination)
      ? [destination, ...destinations]
      : destinations.length > 0
        ? destinations
        : destination
          ? [destination]
          : [],
    destinationFlexible: patch.destinationFlexible ?? base.destinationFlexible,
    origin: patch.origin ?? base.origin,
    startDate: patch.startDate ?? base.startDate,
    endDate: patch.endDate ?? base.endDate,
    durationDays: patch.durationDays ?? base.durationDays,
    travelers: patch.travelers ?? base.travelers,
    travelerType: patch.travelerType ?? base.travelerType,
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
  }

  // Locking a named destination clears flexible discovery.
  if (patch.destination && patch.destinationFlexible !== true) {
    merged.destinationFlexible = false
  }

  // Infer traveler type from count when still unset.
  if (merged.travelerType == null && merged.travelers != null) {
    if (merged.travelers === 1) merged.travelerType = 'solo'
    else if (merged.travelers === 2) merged.travelerType = 'couple'
    else if (merged.travelers >= 3) merged.travelerType = 'family'
  }
  if (merged.travelers == null && merged.travelerType === 'solo') merged.travelers = 1
  if (merged.travelers == null && merged.travelerType === 'couple') merged.travelers = 2

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
    destinationFlexible: raw.destinationFlexible ?? null,
    budgetFlexible: raw.budgetFlexible ?? null,
    budgetStyle: raw.budgetStyle ?? null,
    hotelPreference: raw.hotelPreference ?? null,
    packageScope: raw.packageScope ?? null,
    weatherPreference: raw.weatherPreference ?? null,
    regenerateDay: raw.regenerateDay ?? null,
    regenerateScope: raw.regenerateScope ?? null,
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
