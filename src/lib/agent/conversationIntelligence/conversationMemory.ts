import type { ExtractedEntities, LiveTravelMemory, TravelerBreakdown } from './types'

export function emptyTravelerBreakdown(): TravelerBreakdown {
  return { adults: null, children: null, infants: null, total: null }
}

export function createEmptyLiveTravelMemory(now = new Date()): LiveTravelMemory {
  return {
    destination: null,
    cities: [],
    budgetAmount: null,
    currency: null,
    startDate: null,
    endDate: null,
    monthHint: null,
    flexibleDates: null,
    travelers: emptyTravelerBreakdown(),
    purpose: null,
    hotelPreferences: [],
    flightPreferences: [],
    airlines: [],
    seatPreference: null,
    stopoverPreference: null,
    activities: [],
    visaStatus: null,
    passportNationality: null,
    weatherPreference: null,
    languagePreference: null,
    specialRequests: [],
    updatedAt: now.toISOString(),
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

function mergeTravelers(
  prior: TravelerBreakdown,
  entities: ExtractedEntities,
): TravelerBreakdown {
  const adults = entities.adults ?? prior.adults
  const children = entities.children ?? prior.children
  const infants = entities.infants ?? prior.infants
  let total = prior.total
  if (adults != null || children != null || infants != null) {
    total = (adults ?? 0) + (children ?? 0) + (infants ?? 0)
    if (total === 0) total = adults ?? prior.total
  }
  return { adults, children, infants, total }
}

/** Continuously merge new entities into live travel memory. */
export function updateLiveTravelMemory(
  prior: LiveTravelMemory | null | undefined,
  entities: ExtractedEntities,
  now = new Date(),
): LiveTravelMemory {
  const base = prior ?? createEmptyLiveTravelMemory(now)
  const cities = uniqueStrings([
    ...base.cities,
    ...entities.cities,
    ...(entities.destination ? [entities.destination] : []),
  ])

  return {
    destination: entities.destination ?? base.destination,
    cities,
    budgetAmount: entities.budgetAmount ?? base.budgetAmount,
    currency: entities.currency ?? base.currency,
    startDate: entities.startDate ?? base.startDate,
    endDate: entities.endDate ?? base.endDate,
    monthHint: entities.monthHint ?? base.monthHint,
    flexibleDates: entities.flexibleDates ?? base.flexibleDates,
    travelers: mergeTravelers(base.travelers, entities),
    purpose: entities.purpose ?? base.purpose,
    hotelPreferences: uniqueStrings([
      ...base.hotelPreferences,
      ...entities.hotelPreferences,
    ]),
    flightPreferences: uniqueStrings([
      ...base.flightPreferences,
      ...entities.flightPreferences,
    ]),
    airlines: uniqueStrings([...base.airlines, ...entities.airlines]),
    seatPreference: entities.seatPreference ?? base.seatPreference,
    stopoverPreference: entities.stopoverPreference ?? base.stopoverPreference,
    activities: uniqueStrings([...base.activities, ...entities.activities]),
    visaStatus: entities.visaStatus ?? base.visaStatus,
    passportNationality: entities.passportNationality ?? base.passportNationality,
    weatherPreference: entities.weatherPreference ?? base.weatherPreference,
    languagePreference: base.languagePreference,
    specialRequests: uniqueStrings([
      ...base.specialRequests,
      ...entities.specialRequests,
    ]),
    updatedAt: now.toISOString(),
  }
}

export class ConversationMemory {
  private state: LiveTravelMemory

  constructor(initial?: LiveTravelMemory | null) {
    this.state = initial ? { ...initial, travelers: { ...initial.travelers } } : createEmptyLiveTravelMemory()
  }

  getSnapshot(): LiveTravelMemory {
    return {
      ...this.state,
      cities: [...this.state.cities],
      hotelPreferences: [...this.state.hotelPreferences],
      flightPreferences: [...this.state.flightPreferences],
      airlines: [...this.state.airlines],
      activities: [...this.state.activities],
      specialRequests: [...this.state.specialRequests],
      travelers: { ...this.state.travelers },
    }
  }

  applyEntities(entities: ExtractedEntities): LiveTravelMemory {
    this.state = updateLiveTravelMemory(this.state, entities)
    return this.getSnapshot()
  }
}
