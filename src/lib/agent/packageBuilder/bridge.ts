/**
 * Sprint 83 — agent bridge for AI Dynamic Travel Packages.
 * Additive enrichment — does not change Decision Engine public contracts.
 */

import {
  derivePreferenceWeightBiases,
  runBookingTiming,
  runPackageBuilder,
  rerankPackagesWithPreferences,
  SPRINT83_DYNAMIC_PACKAGES_VERSION,
  type NormalizedActivityOffer,
  type NormalizedAddonOffer,
  type NormalizedFlightOffer,
  type NormalizedHotelOffer,
  type NormalizedTransferOffer,
  type PackageBuilderResult,
  type PackageCandidate,
  type TravelerProfile,
} from '../../../core'
import type { AgentMemory, TripPlan } from '../types'
import { isDynamicPackagesEnabled } from './feature'

type PartialPackageMode = 'flight_first' | 'hotel_first' | 'manual_explanation'

function buildEmptyPoolPackageResult(input: {
  mode: PartialPackageMode
  explanation: string
}): PackageBuilderResult {
  const selected: PackageCandidate = {
    id: `pkg_partial_${input.mode}`,
    title: 'Recovery package — awaiting offers',
    currency: 'SAR',
    totalPrice: 0,
    components: [],
    destination: null,
    checkIn: null,
    checkOut: null,
    arrivalAt: null,
    departureAt: null,
    score: 40,
    dimensions: null,
    confidence: 0.35,
    labels: ['best_value'],
    reasons: [
      'Offer pools were empty — recovery path engaged.',
      'Next: nearby airports/cities, flexible dates, alternative suppliers.',
    ],
    explanation: input.explanation,
    compatible: true,
    rejectionReasons: [],
    normalizedKey: `partial:${input.mode}`,
    providerConfidence: 0.3,
  }
  return {
    version: SPRINT83_DYNAMIC_PACKAGES_VERSION,
    packages: [selected],
    ranked: [selected],
    selected,
    labels: {
      bestOverall: null,
      bestBudget: null,
      bestBusiness: null,
      bestFamily: null,
      bestLuxury: null,
      bestWeekend: null,
      bestValue: selected,
    },
    duplicateCount: 0,
    filteredCount: 0,
    events: [],
    durationMs: 0,
  }
}

function buildPartialPackageResult(input: {
  mode: 'flight_first' | 'hotel_first'
  flights: NormalizedFlightOffer[]
  hotels: NormalizedHotelOffer[]
  destination: string | null
  budgetCap: number | null
}): PackageBuilderResult {
  const components = input.mode === 'flight_first'
    ? input.flights.slice(0, 3).map((f) => ({
      kind: 'flight' as const,
      id: f.id,
      title: `${f.airline} ${f.origin ?? ''}→${f.destination ?? ''}`.trim(),
      price: f.price,
      currency: f.currency,
      payload: { partial: true, stops: f.stops },
    }))
    : input.hotels.slice(0, 3).map((h) => ({
      kind: 'hotel' as const,
      id: h.id,
      title: h.name,
      price: h.price,
      currency: h.currency,
      payload: { partial: true, stars: h.stars },
    }))

  const totalPrice = components.reduce((s, c) => s + c.price, 0)
  const currency = components[0]?.currency ?? 'SAR'
  const missing = input.mode === 'flight_first' ? 'hotel' : 'flight'
  const selected: PackageCandidate = {
    id: `pkg_partial_${input.mode}_${components[0]?.id ?? 'none'}`,
    title: input.mode === 'flight_first'
      ? 'Flight-first partial package'
      : 'Hotel-first partial package',
    currency,
    totalPrice,
    components,
    destination: input.destination,
    checkIn: null,
    checkOut: null,
    arrivalAt: null,
    departureAt: null,
    score: 55,
    dimensions: null,
    confidence: 0.55,
    labels: ['best_value'],
    reasons: [
      `${missing} offers missing — serving ${input.mode.replace('_', '-')} partial.`,
      'Alternatives: other suppliers, nearby areas, flexible dates.',
      input.budgetCap != null ? `Budget cap considered: ${input.budgetCap} ${currency}` : 'No budget cap set.',
    ],
    explanation: [
      `Why: Keep momentum with available ${input.mode === 'flight_first' ? 'flights' : 'hotels'} while recovering the missing side.`,
      `Benefits: Concrete ${input.mode === 'flight_first' ? 'flight' : 'stay'} options now; search continues for ${missing}s.`,
      `Tradeoffs: Incomplete package until ${missing} inventory returns.`,
      `Confidence: 55%.`,
      'Next: confirm this direction or ask for nearby airports / alternative hotels.',
    ].join('\n'),
    compatible: true,
    rejectionReasons: [],
    normalizedKey: `partial:${input.mode}:${components.map((c) => c.id).join('+')}`,
    providerConfidence: 0.5,
  }

  return {
    version: SPRINT83_DYNAMIC_PACKAGES_VERSION,
    packages: [selected],
    ranked: [selected],
    selected,
    labels: {
      bestOverall: null,
      bestBudget: null,
      bestBusiness: null,
      bestFamily: null,
      bestLuxury: null,
      bestWeekend: null,
      bestValue: selected,
    },
    duplicateCount: 0,
    filteredCount: 0,
    events: [],
    durationMs: 0,
  }
}

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

  // Sprint 89 — never silent-skip. Prefer full packages; else partial / one-sided /
  // explanatory fallback so Decision + Conversation always see package intent.
  if (flights.length === 0 && hotels.length === 0) {
    const notes = [
      ...input.tripPlan.notes,
      'Package builder: no flight or hotel offers yet — searching alternatives (nearby cities, flexible dates, other suppliers).',
      'Partial package deferred: flight-first and hotel-first will unlock once either pool returns.',
    ]
    return {
      tripPlan: { ...input.tripPlan, notes },
      dynamicPackages: buildEmptyPoolPackageResult({
        mode: 'manual_explanation',
        explanation:
          'No live offers in either pool. Closest next step: broaden search (nearby airports/cities, flexible dates) then rebuild flight+hotel packages.',
      }),
      flightOffers,
      hotelStays,
    }
  }

  if (flights.length === 0 || hotels.length === 0) {
    const mode = flights.length > 0 ? 'flight_first' : 'hotel_first'
    const partial = buildPartialPackageResult({
      mode,
      flights,
      hotels,
      destination: input.memory.requirements.destination,
      budgetCap: input.memory.requirements.budgetAmount,
    })
    const notes = [
      ...input.tripPlan.notes,
      mode === 'flight_first'
        ? 'Package builder: hotel pool empty — flight-first partial package with hotel alternatives pending.'
        : 'Package builder: flight pool empty — hotel-first partial package with flight alternatives pending.',
      partial.selected?.explanation?.split('\n')[0] ?? '',
    ]
    return {
      tripPlan: { ...input.tripPlan, notes: notes.filter(Boolean) },
      dynamicPackages: partial,
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
