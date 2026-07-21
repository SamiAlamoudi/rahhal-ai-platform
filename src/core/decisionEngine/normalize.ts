/**
 * Sprint 79 — normalize provider payloads into flight/hotel facts.
 */

import type { FlightCandidateFacts, HotelCandidateFacts } from '../types'

function hourFrom(value: unknown): number | null {
  if (typeof value === 'number' && value >= 0 && value <= 23) return value
  if (typeof value === 'string') {
    const m = value.match(/T(\d{2}):/)
    if (m) return Number(m[1])
    const n = Number(value)
    if (!Number.isNaN(n) && n >= 0 && n <= 23) return n
  }
  return null
}

export function normalizeFlight(
  offer: Record<string, unknown>,
  index: number,
): FlightCandidateFacts {
  const durationHours = typeof offer.durationHours === 'number' ? offer.durationHours : null
  const durationMinutes = typeof offer.durationMinutes === 'number'
    ? offer.durationMinutes
    : durationHours != null
      ? Math.round(durationHours * 60)
      : null
  const airline = typeof offer.airline === 'string' ? offer.airline : 'Flight'
  return {
    id: String(offer.id ?? `flt_${index}`),
    providerId: String(offer.providerId ?? offer.source ?? 'mock'),
    airline,
    price: typeof offer.price === 'number' ? offer.price : Number(offer.price) || 0,
    currency: String(offer.currency ?? 'SAR'),
    durationMinutes,
    stops: typeof offer.stops === 'number' ? offer.stops : 0,
    layoverMinutes: typeof offer.layoverMinutes === 'number'
      ? offer.layoverMinutes
      : typeof offer.layoverHours === 'number'
        ? Math.round(offer.layoverHours * 60)
        : null,
    departureHour: hourFrom(offer.departureHour ?? offer.departureTime),
    arrivalHour: hourFrom(offer.arrivalHour ?? offer.arrivalTime),
    cabin: typeof offer.cabin === 'string' ? offer.cabin : null,
    baggageIncluded: offer.baggageIncluded === true || offer.baggage === true,
    refundable: offer.refundable === true,
    airportQuality: typeof offer.airportQuality === 'number' ? offer.airportQuality : null,
    loyaltyMatch: offer.loyaltyMatch === true,
    payload: offer,
  }
}

export function normalizeHotel(
  stay: Record<string, unknown>,
  index: number,
): HotelCandidateFacts {
  const nightly = typeof stay.nightly === 'number'
    ? stay.nightly
    : typeof stay.total === 'number'
      ? stay.total
      : Number(stay.price) || 0
  const total = typeof stay.total === 'number' ? stay.total : nightly
  const name = String(stay.name ?? `Stay ${index + 1}`)
  const stars = typeof stay.hotelStars === 'number'
    ? stay.hotelStars
    : typeof stay.stars === 'number'
      ? stay.stars
      : null
  return {
    id: String(stay.hotelId ?? stay.id ?? `htl_${index}`),
    providerId: String(stay.providerId ?? stay.source ?? 'mock'),
    name,
    price: total,
    currency: String(stay.currency ?? 'SAR'),
    stars,
    rating: typeof stay.rating === 'number' ? stay.rating : null,
    walkMinutes: typeof stay.walkMinutes === 'number'
      ? stay.walkMinutes
      : typeof stay.distanceKm === 'number'
        ? Math.round(stay.distanceKm * 12)
        : null,
    reviewQuality: typeof stay.reviewQuality === 'number' ? stay.reviewQuality : null,
    refundable: stay.refundable === true,
    familyFriendly: stay.familyFriendly === true
      || /\bfamily\b|عائل/.test(name.toLowerCase())
      || (stars ?? 0) >= 4,
    payload: { ...stay, nightly, total },
  }
}

export function candidateKey(flightId: string, hotelId: string): string {
  return `${flightId}::${hotelId}`.toLowerCase()
}
