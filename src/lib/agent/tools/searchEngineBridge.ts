/**
 * Sprint 74 — Conversation → production search engines bridge.
 *
 * Maps agent tool context ↔ Flight/Hotel Search Engine requests/results
 * without changing Provider Runtime, RahhalBrain, or engine internals.
 */

import type { FlightSearchEngine, FlightSearchPage, FlightSearchRequest, UnifiedFlight } from '../flightSearchEngine'
import type { HotelSearchEngine, HotelSearchPage, HotelSearchRequest, UnifiedHotel } from '../hotelSearchEngine'
import { allocateBudget, hotelNightlyCap } from '../budgetIntelligence'
import type { TripRequirements } from '../types'
import type { AgentToolContext } from './types'
import { resolveAirportCode as resolveAirportCodeShared } from '../airportCodes'

/** Shared city → IATA helper (same mapping used by aggregation mocks). */
export function resolveAirportCode(place: string): string {
  return resolveAirportCodeShared(place)
}

function defaultDepartureDate(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 30)
  return d.toISOString().slice(0, 10)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return defaultDepartureDate()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Confirmed traveler count only — never invent 2 / couple / family defaults.
 * Callers must not search when this returns null.
 */
export function travelersFrom(ctx: AgentToolContext): number | null {
  const fromInput = Number(ctx.input?.travelers)
  if (Number.isFinite(fromInput) && fromInput > 0) return Math.floor(fromInput)
  const req = ctx.requirements.travelers
  if (typeof req === 'number' && req > 0) return req
  return null
}

function currencyFrom(ctx: AgentToolContext): string {
  return String(
    ctx.input?.currency
    ?? ctx.requirements.budgetCurrency
    ?? 'SAR',
  )
}

function nightsFrom(ctx: AgentToolContext): number {
  const nights = Number(ctx.input?.nights)
  if (Number.isFinite(nights) && nights > 0) return Math.floor(nights)
  const duration = ctx.requirements.durationDays ?? 3
  return Math.max(1, duration - 1)
}

function inferTripType(req: TripRequirements): FlightSearchRequest['tripType'] {
  if (req.destinations.length > 1) return 'multi_city'
  if (req.endDate) return 'round_trip'
  return 'one_way'
}

function cabinFrom(req: TripRequirements): FlightSearchRequest['cabin'] {
  const explicit = (req.cabinPreference ?? '').toLowerCase()
  if (explicit.includes('first')) return 'first'
  if (explicit.includes('business')) return 'business'
  if (explicit.includes('premium')) return 'premium_economy'
  if (explicit.includes('economy')) return 'economy'
  const purpose = (req.tripPurpose ?? '').toLowerCase()
  const style = (req.budgetStyle ?? '').toLowerCase()
  if (req.travelerType === 'business' || purpose.includes('business')) return 'business'
  if (style === 'luxury' || purpose.includes('honeymoon')) return 'premium_economy'
  return 'economy'
}

export function buildFlightSearchRequest(ctx: AgentToolContext): FlightSearchRequest {
  const req = ctx.requirements
  const originRaw = String(ctx.input?.origin ?? req.origin ?? '').trim()
  if (!originRaw) {
    throw new Error('search_blocked_origin_unconfirmed')
  }
  // Same normalized destination object as planTurn memory — never invent Dubai/DXB/Jordan.
  const destinationRaw = String(
    ctx.input?.destination
    ?? req.destination
    ?? req.destinationCity
    ?? req.destinations[0]
    ?? '',
  ).trim()
  if (!destinationRaw) {
    throw new Error('search_blocked_destination_unconfirmed')
  }
  // Lock search to the single confirmed destination (ignore stale multi-city unions).
  const lockedReq: TripRequirements = {
    ...req,
    destination: destinationRaw || null,
    destinations: destinationRaw ? [destinationRaw] : [],
  }
  const departureDate = String(ctx.input?.startDate ?? lockedReq.startDate ?? defaultDepartureDate())
  const returnDate = (ctx.input?.endDate ?? lockedReq.endDate)
    ? String(ctx.input?.endDate ?? lockedReq.endDate)
    : null
  const tripType = inferTripType(lockedReq)
  const children =
    typeof lockedReq.children === 'number' && lockedReq.children >= 0
      ? Math.floor(lockedReq.children)
      : Number.isFinite(Number(ctx.input?.children)) && Number(ctx.input?.children) >= 0
        ? Math.floor(Number(ctx.input?.children))
        : 0
  const totalTravelers = travelersFrom({ ...ctx, requirements: lockedReq })
  if (totalTravelers == null) {
    throw new Error('search_blocked_travelers_unconfirmed')
  }
  const adults = Math.max(1, totalTravelers - children)
  const currency = currencyFrom({ ...ctx, requirements: lockedReq })
  const preferredAirline =
    typeof ctx.input?.preferredAirline === 'string'
      ? ctx.input.preferredAirline
      : lockedReq.preferredAirline

  const request: FlightSearchRequest = {
    tripType,
    origin: resolveAirportCode(originRaw),
    destination: resolveAirportCode(destinationRaw),
    departureDate,
    returnDate: tripType === 'one_way' ? null : returnDate,
    adults,
    children,
    currency,
    cabin: cabinFrom(lockedReq),
    preferredAirlines: preferredAirline ? [preferredAirline] : undefined,
    sort: 'recommendation',
    pageSize: 20,
    signal: ctx.signal,
    parallel: true,
  }

  if (tripType === 'multi_city' && lockedReq.destinations.length > 1) {
    const hubs = [originRaw, ...lockedReq.destinations]
    const legs = []
    for (let i = 0; i < hubs.length - 1; i += 1) {
      legs.push({
        origin: resolveAirportCode(hubs[i]),
        destination: resolveAirportCode(hubs[i + 1]),
        departureDate: addDays(departureDate, i * 3),
      })
    }
    request.legs = legs
  }

  const budget = req.budgetAmount
  const style = (req.budgetStyle ?? '').toLowerCase()
  const allocation = typeof budget === 'number' && budget > 0
    ? allocateBudget({
      total: budget,
      currency: currencyFrom(ctx),
      style: req.budgetStyle,
      nights: Math.max(1, (req.durationDays ?? 3) - 1),
      flightsOnly: req.packageScope === 'flights_only',
    })
    : null

  if (allocation) {
    request.filters = { maxPrice: allocation.flights }
  } else if (typeof budget === 'number' && budget > 0 && style === 'budget') {
    request.filters = { maxPrice: Math.round(budget * 0.45) }
  }

  return request
}

export function buildHotelSearchRequest(ctx: AgentToolContext): HotelSearchRequest {
  const req = ctx.requirements
  const city = String(
    ctx.input?.destination
    ?? req.destinationCity
    ?? req.destination
    ?? req.destinations[0]
    ?? '',
  )
  const checkIn = String(ctx.input?.checkIn ?? req.startDate ?? defaultDepartureDate())
  const nights = nightsFrom(ctx)
  const checkOut = (ctx.input?.checkOut ?? req.endDate)
    ? String(ctx.input?.checkOut ?? req.endDate)
    : addDays(checkIn, nights)
  const children =
    typeof req.children === 'number' && req.children >= 0
      ? Math.floor(req.children)
      : Number.isFinite(Number(ctx.input?.children)) && Number(ctx.input?.children) >= 0
        ? Math.floor(Number(ctx.input?.children))
        : 0
  const totalTravelers = travelersFrom(ctx)
  if (totalTravelers == null) {
    throw new Error('search_blocked_travelers_unconfirmed')
  }
  const adults = Math.max(1, totalTravelers - children)
  const rooms =
    typeof req.rooms === 'number' && req.rooms > 0
      ? Math.floor(req.rooms)
      : Number.isFinite(Number(ctx.input?.rooms)) && Number(ctx.input?.rooms) > 0
        ? Math.floor(Number(ctx.input?.rooms))
        : req.travelerType === 'family'
          ? Math.max(1, Math.ceil(adults / 2))
          : 1
  const currency = currencyFrom(ctx)
  const style = (req.budgetStyle ?? '').toLowerCase()
  const budget = req.budgetAmount
  const allocation = typeof budget === 'number' && budget > 0
    ? allocateBudget({
      total: budget,
      currency,
      style: req.budgetStyle,
      nights,
      hotelsOnly: false,
      flightsOnly: req.packageScope === 'flights_only',
    })
    : null

  const starMatch = (req.hotelPreference ?? '').match(/([1-5])_star/)
  const minStars = starMatch?.[1] ? Number(starMatch[1]) : null
  const amenities = [
    ...(req.hotelAmenities ?? []),
    ...(Array.isArray(ctx.input?.amenities) ? (ctx.input!.amenities as unknown[]).map(String) : []),
  ].map((a) => a.trim().toLowerCase()).filter(Boolean)

  const request: HotelSearchRequest = {
    city,
    destination: city,
    checkIn,
    checkOut,
    adults,
    children,
    rooms,
    currency,
    sort: 'recommended',
    pageSize: 20,
    signal: ctx.signal,
    parallel: true,
    filters: {},
  }

  if (style === 'luxury' || minStars != null) {
    request.filters = {
      ...request.filters,
      minStars: minStars ?? 4,
      minRating: style === 'luxury' ? 4 : undefined,
    }
  }
  if (allocation) {
    request.filters = {
      ...request.filters,
      maxPrice: hotelNightlyCap(allocation, nights),
    }
  } else if (style === 'budget' && typeof budget === 'number' && budget > 0) {
    request.filters = {
      ...request.filters,
      maxPrice: Math.max(80, Math.round((budget * 0.35) / nights)),
    }
  }
  if (req.breakfastRequired) {
    request.filters = { ...request.filters, breakfastIncluded: true }
  }
  if (req.freeCancellationRequired) {
    request.filters = { ...request.filters, freeCancellationOnly: true }
  }
  if (amenities.length) {
    request.filters = { ...request.filters, amenities }
  }

  return request
}

export function unifiedFlightToOffer(flight: UnifiedFlight, travelers: number): Record<string, unknown> {
  return {
    id: flight.id,
    airline: flight.airline,
    flightNumber: flight.flightNumber,
    from: flight.origin,
    to: flight.destination,
    cabin: flight.cabin,
    stops: flight.stops,
    durationHours: Math.round((flight.duration / 60) * 10) / 10,
    durationMinutes: flight.duration,
    price: flight.price,
    currency: flight.currency,
    travelers,
    refundable: flight.refundable,
    baggage: flight.baggage,
    bookingToken: flight.bookingToken,
    provider: flight.provider,
    score: flight.score,
    departureTime: flight.departureTime,
    arrivalTime: flight.arrivalTime,
    fareFamily: flight.fareFamily,
  }
}

export function unifiedHotelToStay(hotel: UnifiedHotel, nights: number): Record<string, unknown> {
  return {
    name: hotel.hotelName,
    area: hotel.city || 'Center',
    category: hotel.stars >= 4 ? 'boutique' : 'hotel',
    nightly: hotel.pricePerNight,
    nights,
    total: hotel.totalPrice || hotel.pricePerNight * nights,
    currency: hotel.currency,
    score: hotel.score ?? hotel.rating,
    rating: hotel.rating,
    hotelStars: hotel.stars,
    hotelId: hotel.hotelId,
    provider: hotel.provider,
    refundable: hotel.refundable,
    breakfastIncluded: hotel.breakfastIncluded,
    bookingToken: hotel.bookingToken,
    amenities: hotel.amenities,
  }
}

export function flightPageToToolData(
  page: FlightSearchPage,
  travelers: number,
): Record<string, unknown> {
  const offers = page.flights.map((f) => unifiedFlightToOffer(f, travelers))
  const byPrice = [...page.flights].sort((a, b) => a.price - b.price)
  const byDuration = [...page.flights].sort((a, b) => a.duration - b.duration)
  const recommended = page.flights[0]

  return {
    offers,
    currency: offers[0]?.currency ?? 'SAR',
    searchEngine: 'flightSearchEngine',
    engineVersion: 'sprint72',
    diagnostics: page.diagnostics,
    highlights: {
      best: recommended
        ? `${recommended.airline} ${recommended.origin}→${recommended.destination} · ${recommended.price} ${recommended.currency}`
        : null,
      cheapest: byPrice[0]
        ? `${byPrice[0].airline} · ${byPrice[0].price} ${byPrice[0].currency}`
        : null,
      fastest: byDuration[0]
        ? `${byDuration[0].airline} · ${Math.round(byDuration[0].duration / 60)}h`
        : null,
    },
  }
}

export function hotelPageToToolData(
  page: HotelSearchPage,
  nights: number,
): Record<string, unknown> {
  const stays = page.hotels.map((h) => unifiedHotelToStay(h, nights))
  const byPrice = [...page.hotels].sort((a, b) => a.pricePerNight - b.pricePerNight)
  const byRating = [...page.hotels].sort((a, b) => b.rating - a.rating)
  const recommended = page.hotels[0]

  return {
    stays,
    searchEngine: 'hotelSearchEngine',
    engineVersion: 'sprint73',
    diagnostics: page.diagnostics,
    highlights: {
      best: recommended
        ? `${recommended.hotelName} · ${recommended.pricePerNight} ${recommended.currency}/night`
        : null,
      cheapest: byPrice[0]
        ? `${byPrice[0].hotelName} · ${byPrice[0].pricePerNight} ${byPrice[0].currency}/night`
        : null,
      highestRated: byRating[0]
        ? `${byRating[0].hotelName} · ★${byRating[0].rating}`
        : null,
    },
  }
}

export async function runFlightSearchTool(
  engine: FlightSearchEngine,
  ctx: AgentToolContext,
): Promise<{ data: Record<string, unknown>; empty: boolean; gracefulMessage?: string }> {
  const request = buildFlightSearchRequest(ctx)
  const tripType = request.tripType ?? 'round_trip'
  const page =
    tripType === 'one_way'
      ? await engine.searchOneWay(request)
      : tripType === 'multi_city'
        ? await engine.searchMultiCity(request)
        : await engine.searchRoundTrip(request)
  const travelers = travelersFrom(ctx)
  if (travelers == null) {
    throw new Error('search_blocked_travelers_unconfirmed')
  }
  return {
    data: flightPageToToolData(page, travelers),
    empty: page.flights.length === 0,
    gracefulMessage: page.diagnostics.gracefulMessage,
  }
}

export async function runHotelSearchTool(
  engine: HotelSearchEngine,
  ctx: AgentToolContext,
): Promise<{ data: Record<string, unknown>; empty: boolean; gracefulMessage?: string }> {
  const request = buildHotelSearchRequest(ctx)
  const page = await engine.searchHotels(request)
  const nights = nightsFrom(ctx)
  return {
    data: hotelPageToToolData(page, nights),
    empty: page.hotels.length === 0,
    gracefulMessage: page.diagnostics.gracefulMessage,
  }
}
