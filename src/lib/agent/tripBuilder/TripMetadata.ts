/**
 * Sprint 110 — TripMetadata + Decision Engine / Response Composer adapters.
 * Does not modify Decision Engine or Response Composer public contracts.
 */

import { toDecisionEngineOfferRecord } from '../liveFlightSearch/LiveFlightSearchMapper'
import { toDecisionEngineHotelRecord } from '../liveHotelSearch/LiveHotelSearchMapper'
import type {
  ResponseComposerFlightFacts,
  ResponseComposerInput,
} from '../responseComposer/types'
import type {
  TripCandidate,
  TripPackageForComposer,
  TripRankKind,
  TripRankedGroup,
} from './types'

export function estimateTravelQuality(trip: {
  flightStops: number | null
  flightDurationMinutes: number | null
  cabin: string | null
  hotelStars: number | null
  freeCancellation: boolean
  refundableFlight: boolean
  nights: number
}): number {
  let score = 55
  if (trip.flightStops === 0) score += 15
  else if (trip.flightStops === 1) score += 5
  else if (trip.flightStops != null && trip.flightStops >= 2) score -= 10

  if (trip.flightDurationMinutes != null) {
    if (trip.flightDurationMinutes <= 180) score += 8
    else if (trip.flightDurationMinutes >= 600) score -= 8
  }

  const cabin = (trip.cabin ?? '').toLowerCase()
  if (cabin.includes('first')) score += 12
  else if (cabin.includes('business')) score += 10
  else if (cabin.includes('premium')) score += 6

  if (trip.hotelStars != null) {
    score += Math.min(15, Math.max(0, trip.hotelStars) * 3)
  }

  if (trip.freeCancellation) score += 4
  if (trip.refundableFlight) score += 3
  if (trip.nights >= 2 && trip.nights <= 7) score += 3

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function estimateTripConfidence(input: {
  compatible: boolean
  travelQuality: number
  underBudget: boolean | null
  hasPrices: boolean
  providerConfidence: number
}): number {
  if (!input.compatible) return 0.25
  let c = 0.45
  c += (input.travelQuality / 100) * 0.35
  c += Math.max(0, Math.min(1, input.providerConfidence)) * 0.15
  if (input.hasPrices) c += 0.05
  if (input.underBudget === true) c += 0.05
  if (input.underBudget === false) c -= 0.08
  return Math.max(0, Math.min(1, Math.round(c * 1000) / 1000))
}

export function computeTripScore(input: {
  travelQuality: number
  confidence: number
  totalCost: number
  budget: number | null
  compatible: boolean
}): number {
  if (!input.compatible) return Math.max(0, input.travelQuality * 0.3)
  let score = input.travelQuality * 0.55 + input.confidence * 100 * 0.25
  if (input.budget != null && input.budget > 0 && input.totalCost > 0) {
    const util = input.totalCost / input.budget
    if (util <= 1) score += (1 - util) * 20
    else score -= Math.min(25, (util - 1) * 30)
  } else if (input.totalCost > 0) {
    // Mild preference for lower cost when no budget
    score += Math.max(0, 10 - input.totalCost / 2000)
  }
  return Math.round(score * 10) / 10
}

/** Reorder Decision Engine pools so trip-preferred offers come first. */
export function prioritizeOffersForDecisionEngine(input: {
  ranked: TripCandidate[]
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
}): {
  flightOffers: Array<Record<string, unknown>>
  hotelStays: Array<Record<string, unknown>>
} {
  const orderFlight = new Map<string, number>()
  const orderHotel = new Map<string, number>()
  let i = 0
  for (const trip of input.ranked) {
    if (!orderFlight.has(trip.flight.id)) orderFlight.set(trip.flight.id, i++)
    if (!orderHotel.has(trip.hotel.id)) orderHotel.set(trip.hotel.id, i++)
  }

  const fromTripsFlights = input.ranked.map((t) =>
    toDecisionEngineOfferRecord(t.flight),
  )
  const fromTripsHotels = input.ranked.map((t) =>
    toDecisionEngineHotelRecord(t.hotel),
  )

  const mergeUnique = (
    primary: Array<Record<string, unknown>>,
    secondary: Array<Record<string, unknown>>,
  ) => {
    const seen = new Set<string>()
    const out: Array<Record<string, unknown>> = []
    for (const row of [...primary, ...secondary]) {
      const id = String(row.id ?? '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(row)
    }
    return out
  }

  const flights = mergeUnique(fromTripsFlights, input.flightOffers ?? [])
  const hotels = mergeUnique(fromTripsHotels, input.hotelStays ?? [])

  const sortBy = (
    list: Array<Record<string, unknown>>,
    map: Map<string, number>,
  ) =>
    [...list].sort((a, b) => {
      const ai = map.get(String(a.id ?? '')) ?? 9999
      const bi = map.get(String(b.id ?? '')) ?? 9999
      return ai - bi
    })

  return {
    flightOffers: sortBy(flights, orderFlight),
    hotelStays: sortBy(hotels, orderHotel),
  }
}

export function flightToComposerFacts(
  flight: TripCandidate['flight'],
): ResponseComposerFlightFacts {
  return {
    id: flight.id,
    providerId: flight.providerId,
    title: flight.title,
    airline: flight.airline,
    origin: flight.origin,
    destination: flight.destination,
    price: flight.price,
    currency: flight.currency,
    durationMinutes: flight.durationMinutes,
    stops: flight.stops,
    cabin: flight.cabin,
    departureAt: flight.departureAt,
    arrivalAt: flight.arrivalAt,
    refundable: flight.refundable,
    seatsRemaining: flight.seatsRemaining,
  }
}

export function toTripPackageForComposer(
  trip: TripCandidate,
  rankKind: TripRankKind | null,
): TripPackageForComposer {
  return {
    tripId: trip.id,
    title: trip.title,
    destination: trip.destination,
    totalCost: trip.cost.totalCost,
    currency: trip.cost.currency,
    nights: trip.nights,
    confidence: trip.confidence,
    explanation: trip.explanation,
    labels: trip.labels.slice(),
    flight: flightToComposerFacts(trip.flight),
    hotel: {
      id: trip.hotel.id,
      hotelId: trip.hotel.hotelId,
      hotelName: trip.hotel.hotelName,
      price: trip.hotel.price,
      currency: trip.hotel.currency,
      stars: trip.hotel.stars,
      freeCancellation: trip.hotel.freeCancellation,
      city: trip.hotel.city,
    },
    rankKind,
  }
}

export function buildResponseComposerPackages(
  ranked: TripCandidate[],
  rankings: TripRankedGroup[],
): TripPackageForComposer[] {
  const kindById = new Map<string, TripRankKind>()
  for (const g of rankings) {
    if (g.trip && !kindById.has(g.trip.id)) {
      kindById.set(g.trip.id, g.kind)
    }
  }
  return ranked.map((t) =>
    toTripPackageForComposer(t, kindById.get(t.id) ?? t.labels[0] ?? null),
  )
}

/**
 * Maps complete trip packages into ResponseComposerInput without changing
 * Response Composer behavior (still flight-fact based + labeled picks).
 */
export function toResponseComposerInput(input: {
  conversationId?: string | null
  destination?: string | null
  departureDate?: string | null
  returnDate?: string | null
  currency?: string | null
  adults?: number | null
  packages: TripPackageForComposer[]
  selected?: TripCandidate | null
  rankings?: TripRankedGroup[]
}): ResponseComposerInput {
  const flights = input.packages.map((p) => ({
    ...p.flight,
    // Surface package total as price context when flight price alone understates trip
    score: p.confidence,
  }))

  const findId = (kind: TripRankKind): string | null => {
    const hit = input.rankings?.find((r) => r.kind === kind)?.trip
    return hit?.flight.id ?? null
  }

  return {
    conversationId: input.conversationId ?? null,
    trip: {
      origin: input.packages[0]?.flight.origin ?? null,
      destination: input.destination ?? input.packages[0]?.destination ?? null,
      departureDate: input.departureDate ?? null,
      returnDate: input.returnDate ?? null,
      travelers: input.adults ?? null,
      currency: input.currency ?? input.packages[0]?.currency ?? null,
    },
    flights,
    decisionConfidence: input.selected?.confidence ?? null,
    decisionExplanation: input.selected?.explanation ?? null,
    labeled: {
      bestOverallId: findId('best_overall'),
      cheapestId: findId('best_budget'),
      fastestId: null,
      bestComfortId: findId('best_luxury'),
      bestValueId: findId('best_value'),
    },
  }
}

export function buildTripMetadata(input: {
  destination: string | null
  departureDate: string | null
  returnDate: string | null
  checkInDate: string | null
  checkOutDate: string | null
  budget: number | null
  currency: string | null
  flightCount: number
  hotelCount: number
  candidateCount: number
  conversationId: string | null
}): TripBuilderResultMeta {
  return { ...input }
}

export type TripBuilderResultMeta = {
  destination: string | null
  departureDate: string | null
  returnDate: string | null
  checkInDate: string | null
  checkOutDate: string | null
  budget: number | null
  currency: string | null
  flightCount: number
  hotelCount: number
  candidateCount: number
  conversationId: string | null
}

export class TripMetadata {
  build(input: Parameters<typeof buildTripMetadata>[0]) {
    return buildTripMetadata(input)
  }
}

export function createTripMetadata(): TripMetadata {
  return new TripMetadata()
}
