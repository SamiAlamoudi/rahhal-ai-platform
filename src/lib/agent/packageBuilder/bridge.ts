/**
 * Sprint 83 — agent bridge for AI Dynamic Travel Packages.
 * Additive enrichment — does not change Decision Engine public contracts.
 */

import {
  derivePreferenceWeightBiases,
  runBookingTiming,
  runPackageBuilder,
  rerankPackagesWithPreferences,
  type NormalizedActivityOffer,
  type NormalizedAddonOffer,
  type NormalizedFlightOffer,
  type NormalizedHotelOffer,
  type NormalizedTransferOffer,
  type PackageBuilderResult,
  type TravelerProfile,
} from '../../../core'
import type { AgentMemory, TripPlan } from '../types'
import { isDynamicPackagesEnabled } from './feature'

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function normalizeFlightOffers(
  offers: Array<Record<string, unknown>>,
): NormalizedFlightOffer[] {
  return offers.map((o, i) => ({
    id: str(o.id) ?? `flight_${i}`,
    airline: str(o.airline) ?? 'Airline',
    price: num(o.price) ?? num(o.total) ?? 0,
    currency: str(o.currency) ?? 'SAR',
    durationMinutes: num(o.durationMinutes),
    stops: num(o.stops) ?? 0,
    arrivalAt: str(o.arrivalAt) ?? str(o.arrival),
    departureAt: str(o.departureAt) ?? str(o.departure),
    destination: str(o.destination) ?? str(o.to),
    origin: str(o.origin) ?? str(o.from),
    cabin: str(o.cabin),
    refundable: o.refundable === true,
    loyaltyMatch: o.loyaltyMatch === true,
    seatsRemaining: num(o.seatsRemaining) ?? num(o.availableSeats),
    providerConfidence: num(o.providerConfidence) ?? (str(o.providerId) === 'mock' ? 0.7 : 0.85),
    payload: o,
  })).filter((f) => f.price > 0)
}

export function normalizeHotelOffers(
  stays: Array<Record<string, unknown>>,
): NormalizedHotelOffer[] {
  return stays.map((s, i) => ({
    id: str(s.id) ?? `hotel_${i}`,
    name: str(s.name) ?? 'Hotel',
    price: num(s.total) ?? num(s.price) ?? 0,
    currency: str(s.currency) ?? 'SAR',
    stars: num(s.hotelStars) ?? num(s.stars),
    rating: num(s.rating),
    walkMinutes: num(s.walkMinutes),
    checkIn: str(s.checkIn) ?? str(s.check_in),
    checkOut: str(s.checkOut) ?? str(s.check_out),
    destination: str(s.destination) ?? str(s.city),
    familyFriendly: s.familyFriendly === true,
    refundable: s.refundable === true,
    breakfastIncluded: s.breakfastIncluded === true || s.breakfast === true,
    luxury: s.luxury === true || (num(s.hotelStars) ?? num(s.stars) ?? 0) >= 5,
    businessFriendly: s.businessFriendly === true || s.business === true,
    providerConfidence: num(s.providerConfidence) ?? (str(s.providerId) === 'mock' ? 0.7 : 0.85),
    payload: s,
  })).filter((h) => h.price > 0)
}

export function normalizeTransfers(
  items: Array<Record<string, unknown>> | undefined,
): NormalizedTransferOffer[] {
  return (items ?? []).map((t, i) => ({
    id: str(t.id) ?? `xfer_${i}`,
    title: str(t.title) ?? str(t.name) ?? 'Airport transfer',
    price: num(t.price) ?? num(t.total) ?? 0,
    currency: str(t.currency) ?? 'SAR',
    durationMinutes: num(t.durationMinutes),
    availableFrom: str(t.availableFrom),
    availableTo: str(t.availableTo),
    destination: str(t.destination),
    providerConfidence: num(t.providerConfidence) ?? 0.8,
    payload: t,
  })).filter((t) => t.price >= 0)
}

export function normalizeActivities(
  items: Array<Record<string, unknown>> | undefined,
): NormalizedActivityOffer[] {
  return (items ?? []).map((a, i) => ({
    id: str(a.id) ?? `act_${i}`,
    title: str(a.title) ?? str(a.name) ?? 'Activity',
    price: num(a.price) ?? num(a.total) ?? 0,
    currency: str(a.currency) ?? 'SAR',
    startAt: str(a.startAt) ?? str(a.start),
    endAt: str(a.endAt) ?? str(a.end),
    destination: str(a.destination),
    quality: num(a.quality) ?? num(a.rating),
    familyFriendly: a.familyFriendly === true,
    providerConfidence: num(a.providerConfidence) ?? 0.8,
    payload: a,
  }))
}

export function normalizeAddons(
  items: Array<Record<string, unknown>> | undefined,
): NormalizedAddonOffer[] {
  return (items ?? []).map((a, i) => {
    const kindRaw = str(a.kind) ?? str(a.type) ?? 'insurance'
    const kind = (
      kindRaw === 'lounge' || kindRaw === 'esim' || kindRaw === 'visa' || kindRaw === 'insurance'
        ? kindRaw
        : 'insurance'
    ) as NormalizedAddonOffer['kind']
    return {
      id: str(a.id) ?? `addon_${i}`,
      kind,
      title: str(a.title) ?? str(a.name) ?? kind,
      price: num(a.price) ?? 0,
      currency: str(a.currency) ?? 'SAR',
      providerConfidence: num(a.providerConfidence) ?? 0.75,
      payload: a,
    }
  })
}

/**
 * Reorder offer pools so Decision Engine consumes package-preferred options first
 * without changing Decision Engine public contracts.
 */
export function prioritizeOffersForDecisionEngine(input: {
  packages: PackageBuilderResult
  flightOffers: Array<Record<string, unknown>>
  hotelStays: Array<Record<string, unknown>>
}): {
  flightOffers: Array<Record<string, unknown>>
  hotelStays: Array<Record<string, unknown>>
} {
  const orderFlight = new Map<string, number>()
  const orderHotel = new Map<string, number>()
  let i = 0
  for (const pkg of input.packages.ranked) {
    for (const c of pkg.components) {
      if (c.kind === 'flight' && !orderFlight.has(c.id)) orderFlight.set(c.id, i++)
      if (c.kind === 'hotel' && !orderHotel.has(c.id)) orderHotel.set(c.id, i++)
    }
  }
  const sortBy = (
    list: Array<Record<string, unknown>>,
    map: Map<string, number>,
  ) => [...list].sort((a, b) => {
    const ai = map.get(String(a.id ?? '')) ?? 9999
    const bi = map.get(String(b.id ?? '')) ?? 9999
    return ai - bi
  })
  return {
    flightOffers: sortBy(input.flightOffers, orderFlight),
    hotelStays: sortBy(input.hotelStays, orderHotel),
  }
}

export async function enrichWithDynamicPackages(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  enabled?: boolean
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  transfers?: Array<Record<string, unknown>>
  activities?: Array<Record<string, unknown>>
  addons?: Array<Record<string, unknown>>
  learnedProfile?: TravelerProfile | null
}): Promise<{
  tripPlan: TripPlan
  dynamicPackages: PackageBuilderResult | null
  /** Offer pools reordered for Decision Engine consumption. */
  flightOffers: Array<Record<string, unknown>>
  hotelStays: Array<Record<string, unknown>>
}> {
  const flightOffers = input.flightOffers ?? []
  const hotelStays = input.hotelStays ?? []

  if (!isDynamicPackagesEnabled({ enabled: input.enabled })) {
    return {
      tripPlan: input.tripPlan,
      dynamicPackages: null,
      flightOffers,
      hotelStays,
    }
  }

  const flights = normalizeFlightOffers(flightOffers)
  const hotels = normalizeHotelOffers(hotelStays)
  if (flights.length === 0 || hotels.length === 0) {
    return {
      tripPlan: input.tripPlan,
      dynamicPackages: null,
      flightOffers,
      hotelStays,
    }
  }

  // Price Intelligence enrichment (reuse engine — no duplicate pricing logic).
  const mid = Math.round(
    (Math.min(...flights.map((f) => f.price)) + Math.min(...hotels.map((h) => h.price))),
  )
  const timing = runBookingTiming({
    currentPrice: mid,
    currency: flights[0]?.currency ?? 'SAR',
    cheapestPrice: Math.min(...flights.map((f) => f.price)) + Math.min(...hotels.map((h) => h.price)),
    premiumPrice: Math.max(...flights.map((f) => f.price)) + Math.max(...hotels.map((h) => h.price)),
    budgetCap: input.memory.requirements.budgetAmount,
    departureDate: input.memory.requirements.startDate ?? input.tripPlan.startDate,
  })
  const priceTimingBoost = timing.recommendation.confidence

  const biases = input.learnedProfile
    ? derivePreferenceWeightBiases(input.learnedProfile)
    : undefined

  let result = await runPackageBuilder({
    flights,
    hotels,
    transfers: normalizeTransfers(input.transfers),
    activities: normalizeActivities(input.activities),
    addons: normalizeAddons(input.addons),
    budgetCap: input.memory.requirements.budgetAmount,
    travelerType: input.memory.requirements.travelerType,
    tripPurpose: input.memory.requirements.tripPurpose,
    isWeekend: null,
    maxCandidates: 24,
    preferenceBiases: biases,
    priceTimingBoost,
  })

  // Adaptive Learning may re-rank packages using learned preferences.
  if (biases) {
    const reranked = rerankPackagesWithPreferences(result.ranked, biases)
    result = {
      ...result,
      ranked: reranked,
      packages: reranked,
      selected: reranked[0] ?? result.selected,
    }
  }

  const prioritized = prioritizeOffersForDecisionEngine({
    packages: result,
    flightOffers,
    hotelStays,
  })

  const best = result.selected ?? result.ranked[0] ?? null
  const notes = [...input.tripPlan.notes]
  if (best) {
    notes.push(
      `Dynamic package: ${best.title} · score ${best.score ?? 0}/100 · conf ${Math.round((best.confidence ?? 0) * 100)}% · ${(best.labels.join(', ') || 'recommended')}`,
    )
    if (best.explanation) {
      notes.push(best.explanation.split('\n')[0] ?? '')
    }
  }

  let nextPlan = { ...input.tripPlan, notes: notes.filter(Boolean) }
  if (best) {
    const flight = best.components.find((c) => c.kind === 'flight')
    const hotel = best.components.find((c) => c.kind === 'hotel')
    if (flight && nextPlan.flights.length > 0) {
      nextPlan = {
        ...nextPlan,
        flights: [{
          ...nextPlan.flights[0]!,
          airline: flight.title.split(' ')[0] ?? nextPlan.flights[0]!.airline,
          estimatedCost: flight.price,
          currency: flight.currency,
          notes: `Package score ${best.score ?? 0}/100 · conf ${Math.round(best.confidence * 100)}%`,
        }, ...nextPlan.flights.slice(1)],
      }
    }
    if (hotel && nextPlan.accommodations.length > 0) {
      nextPlan = {
        ...nextPlan,
        accommodations: [{
          ...nextPlan.accommodations[0]!,
          name: hotel.title,
          fit: `Package ${best.labels.join('/') || 'recommended'}`,
          estimatedNightly: hotel.price,
          currency: hotel.currency,
        }, ...nextPlan.accommodations.slice(1)],
      }
    }
  }

  return {
    tripPlan: nextPlan,
    dynamicPackages: result,
    flightOffers: prioritized.flightOffers,
    hotelStays: prioritized.hotelStays,
  }
}

export type { PackageBuilderResult }
