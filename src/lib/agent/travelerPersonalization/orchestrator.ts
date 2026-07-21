/**
 * Sprint 76 — Traveler Personalization orchestrator.
 */

import type { AgentMemory } from '../types'
import { parsePreferenceUtterance } from './parsePreferences'
import {
  confidenceMap,
  emptyTravelerProfile,
  learnListPreference,
  learnSingularPreference,
  matchedPreferenceLabels,
} from './profile'
import {
  rankFlightsByPersonalization,
  rankHotelsByPersonalization,
  type FlightPersonalizationRow,
  type HotelPersonalizationRow,
} from './rank'
import {
  getOrCreateProfile,
  getTravelerProfileStore,
  type TravelerProfileStore,
} from './storage'
import type {
  CabinPreference,
  LearningEvent,
  RankingAdjustment,
  SeatPreference,
  SmokingPreference,
  TravelerPersonalizationDiagnostics,
  TravelerPersonalizationResult,
  TravelerProfile,
  TripStyleKind,
} from './types'
import { SPRINT76_TRAVELER_PERSONALIZATION_VERSION } from './types'

export interface RunTravelerPersonalizationInput {
  userId: string | null | undefined
  userText?: string | null
  memory?: AgentMemory | null
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  store?: TravelerProfileStore
  /** When true, skip learning (rank-only against existing profile). */
  skipLearning?: boolean
}

function readFlightRows(offers: Array<Record<string, unknown>>): FlightPersonalizationRow[] {
  return offers.map((offer, index) => {
    const airline = typeof offer.airline === 'string' ? offer.airline : 'Flight'
    const from = String(offer.from ?? offer.origin ?? '')
    const to = String(offer.to ?? offer.destination ?? '')
    return {
      id: String(offer.id ?? `flt_${index}`),
      title: `${airline} ${from}→${to}`.trim(),
      airline,
      cabin: typeof offer.cabin === 'string' ? offer.cabin : null,
      stops: typeof offer.stops === 'number' ? offer.stops : null,
      baseScore: typeof offer.score === 'number' ? offer.score : 50,
      payload: offer,
    }
  })
}

function readHotelRows(stays: Array<Record<string, unknown>>): HotelPersonalizationRow[] {
  return stays.map((stay, index) => {
    const name = String(stay.name ?? `Stay ${index + 1}`)
    const chain = typeof stay.chain === 'string'
      ? stay.chain
      : typeof stay.brand === 'string'
        ? stay.brand
        : null
    return {
      id: String(stay.hotelId ?? stay.id ?? `htl_${index}`),
      title: name,
      name,
      chain,
      stars: typeof stay.hotelStars === 'number'
        ? stay.hotelStars
        : typeof stay.stars === 'number'
          ? stay.stars
          : null,
      baseScore: typeof stay.score === 'number' ? stay.score : typeof stay.rating === 'number' ? stay.rating * 10 : 50,
      payload: stay,
    }
  })
}

function applySignals(
  profile: TravelerProfile,
  userText: string | null | undefined,
  memory?: AgentMemory | null,
): { profile: TravelerProfile; events: LearningEvent[] } {
  const now = new Date().toISOString()
  let next = { ...profile }
  const events: LearningEvent[] = []
  const signals = parsePreferenceUtterance(userText)

  for (const signal of signals) {
    if (signal.field === 'airline') {
      const learned = learnListPreference(next.preferredAirlines, signal.value, signal.polarity, 'preferredAirlines', now)
      next = { ...next, preferredAirlines: learned.list }
      events.push(learned.event)
    } else if (signal.field === 'alliance' || signal.field === 'directFlights') {
      const value = signal.field === 'directFlights' ? 'direct' : signal.value
      const learned = learnListPreference(next.preferredAlliances, value, signal.polarity, 'preferredAlliances', now)
      next = { ...next, preferredAlliances: learned.list }
      events.push(learned.event)
    } else if (signal.field === 'hotelChain') {
      const learned = learnListPreference(next.hotelChains, signal.value, signal.polarity, 'hotelChains', now)
      next = { ...next, hotelChains: learned.list }
      events.push(learned.event)
    } else if (signal.field === 'meal') {
      const learned = learnListPreference(next.mealPreferences, signal.value, signal.polarity, 'mealPreferences', now)
      next = { ...next, mealPreferences: learned.list }
      events.push(learned.event)
    } else if (signal.field === 'destination') {
      const learned = learnListPreference(next.favoriteDestinations, signal.value, signal.polarity, 'favoriteDestinations', now)
      next = { ...next, favoriteDestinations: learned.list }
      events.push(learned.event)
    } else if (signal.field === 'departureAirport') {
      const learned = learnListPreference(
        next.preferredDepartureAirports,
        signal.value,
        signal.polarity,
        'preferredDepartureAirports',
        now,
      )
      next = { ...next, preferredDepartureAirports: learned.list }
      events.push(learned.event)
    } else if (signal.field === 'loyalty') {
      const learned = learnListPreference(next.loyaltyPrograms, signal.value, signal.polarity, 'loyaltyPrograms', now)
      next = { ...next, loyaltyPrograms: learned.list }
      events.push(learned.event)
    } else if (signal.field === 'cabin') {
      const learned = learnSingularPreference(
        next.preferredCabin,
        signal.value as CabinPreference,
        signal.polarity,
        'preferredCabin',
        now,
      )
      next = { ...next, preferredCabin: learned.preference }
      events.push(learned.event)
    } else if (signal.field === 'seat') {
      const learned = learnSingularPreference(
        next.preferredSeat,
        signal.value as SeatPreference,
        signal.polarity,
        'preferredSeat',
        now,
      )
      next = { ...next, preferredSeat: learned.preference }
      events.push(learned.event)
    } else if (signal.field === 'roomType') {
      const learned = learnSingularPreference(next.roomType, signal.value, signal.polarity, 'roomType', now)
      next = { ...next, roomType: learned.preference }
      events.push(learned.event)
    } else if (signal.field === 'smoking') {
      const learned = learnSingularPreference(
        next.smokingPreference,
        signal.value as SmokingPreference,
        signal.polarity,
        'smokingPreference',
        now,
      )
      next = { ...next, smokingPreference: learned.preference }
      events.push(learned.event)
    } else if (signal.field === 'tripStyle') {
      const learned = learnSingularPreference(
        next.tripStyle,
        signal.value as TripStyleKind,
        signal.polarity,
        'tripStyle',
        now,
      )
      next = { ...next, tripStyle: learned.preference }
      events.push(learned.event)
    } else if (signal.field === 'hotelStars' && signal.numericValue != null) {
      const learned = learnSingularPreference(
        next.hotelStarPreference,
        signal.numericValue,
        'prefer',
        'hotelStarPreference',
        now,
      )
      next = { ...next, hotelStarPreference: learned.preference }
      events.push(learned.event)
    }
  }

  // Soft budget history from memory (additive observation only).
  const amount = memory?.requirements.budgetAmount
  const currency = memory?.requirements.budgetCurrency ?? 'SAR'
  if (typeof amount === 'number' && amount > 0) {
    const last = next.budgetHistory[next.budgetHistory.length - 1]
    if (!last || last.amount !== amount || last.currency !== currency) {
      next = {
        ...next,
        budgetHistory: [
          ...next.budgetHistory.slice(-19),
          { amount, currency, observedAt: now },
        ],
      }
      events.push({
        kind: 'budget_history',
        field: 'budgetHistory',
        value: `${amount} ${currency}`,
        polarity: 'prefer',
        previousConfidence: null,
        nextConfidence: 1,
        conflict: false,
      })
    }
  }

  // Destination soft learn from current trip requirements.
  const destination = memory?.requirements.destination
  if (destination && signals.some((s) => s.field === 'destination') === false) {
    // only reinforce favorite when explicitly preferred; skip silent destination copy
  }

  next = { ...next, updatedAt: now }
  return { profile: next, events }
}

export function buildPersonalizationDiagnostics(input: {
  profile: TravelerProfile | null
  learningEvents: LearningEvent[]
  rankingAdjustments: RankingAdjustment[]
  missingProfile: boolean
}): TravelerPersonalizationDiagnostics {
  const profile = input.profile
  return {
    travelerProfileUsed: profile != null && matchedPreferenceLabels(profile).length > 0,
    matchedPreferences: profile ? matchedPreferenceLabels(profile) : [],
    confidenceScores: profile ? confidenceMap(profile) : {},
    rankingAdjustments: input.rankingAdjustments,
    learningEvents: input.learningEvents,
    missingProfile: input.missingProfile,
  }
}

export function runTravelerPersonalization(
  input: RunTravelerPersonalizationInput,
): TravelerPersonalizationResult {
  const started = Date.now()
  const store = input.store ?? getTravelerProfileStore()
  const userId = (input.userId ?? '').trim()
  const missingProfile = !userId

  let profile: TravelerProfile | null = null
  let learningEvents: LearningEvent[] = []

  if (!missingProfile) {
    const existing = store.get(userId)
    const base = existing ?? emptyTravelerProfile(userId)
    if (input.skipLearning) {
      profile = base
    } else {
      const applied = applySignals(base, input.userText, input.memory)
      profile = store.save(applied.profile)
      learningEvents = applied.events
    }
    if (!existing && learningEvents.length === 0 && input.skipLearning) {
      // ensure get-or-create for rank-only path when profile never existed
      profile = getOrCreateProfile(userId, store)
    }
  }

  const flightRows = readFlightRows(input.flightOffers ?? [])
  const hotelRows = readHotelRows(input.hotelStays ?? [])
  const rankedFlights = rankFlightsByPersonalization(flightRows, profile)
  const rankedHotels = rankHotelsByPersonalization(hotelRows, profile)

  const rankingAdjustments: RankingAdjustment[] = [
    ...rankedFlights
      .filter((r) => r.delta !== 0)
      .map((r) => ({
        candidateId: r.id,
        kind: 'flight' as const,
        delta: r.delta,
        reasons: r.reasons,
      })),
    ...rankedHotels
      .filter((r) => r.delta !== 0)
      .map((r) => ({
        candidateId: r.id,
        kind: 'hotel' as const,
        delta: r.delta,
        reasons: r.reasons,
      })),
  ]

  const diagnostics = buildPersonalizationDiagnostics({
    profile,
    learningEvents,
    rankingAdjustments,
    missingProfile,
  })

  const recommendationFacts: string[] = []
  if (diagnostics.matchedPreferences.length > 0) {
    recommendationFacts.push(
      `Traveler prefs: ${diagnostics.matchedPreferences.slice(0, 5).join(', ')}`,
    )
  }
  if (rankedFlights[0]?.reasons.length) {
    recommendationFacts.push(
      `Top flight fit: ${rankedFlights[0].title} (${rankedFlights[0].reasons.join('; ')})`,
    )
  }
  if (rankedHotels[0]?.reasons.length) {
    recommendationFacts.push(
      `Top hotel fit: ${rankedHotels[0].title} (${rankedHotels[0].reasons.join('; ')})`,
    )
  }
  if (learningEvents.length > 0) {
    recommendationFacts.push(`Learned ${learningEvents.length} preference signal(s) this turn`)
  }

  return {
    version: SPRINT76_TRAVELER_PERSONALIZATION_VERSION,
    profile,
    diagnostics,
    rankedFlights,
    rankedHotels,
    recommendationFacts,
    durationMs: Date.now() - started,
  }
}
