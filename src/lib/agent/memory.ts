import type { ChatMessage } from '../chat/chatTypes'
import type { AgentMemory, AgentProviderMeta, TripPlan, TripRequirements } from './types'
import { emptyMemory, emptyRequirements, INTAKE_FIELD_ORDER, withTripPlan } from './types'

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
): TripRequirements {
  const destinations = patch.destinations && patch.destinations.length > 0
    ? uniqueStrings([...base.destinations, ...patch.destinations])
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

export function missingRequirementFields(requirements: TripRequirements): Array<keyof TripRequirements> {
  const req = normalizeRequirements(requirements)
  const missing: Array<keyof TripRequirements> = []

  for (const field of INTAKE_FIELD_ORDER) {
    if (field === 'destination') {
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
    budgetFlexible: raw.budgetFlexible ?? null,
    budgetStyle: raw.budgetStyle ?? null,
    hotelPreference: raw.hotelPreference ?? null,
    packageScope: raw.packageScope ?? null,
    weatherPreference: raw.weatherPreference ?? null,
    regenerateDay: raw.regenerateDay ?? null,
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
