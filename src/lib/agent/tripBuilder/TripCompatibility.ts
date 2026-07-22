/**
 * Sprint 110 — TripCompatibility
 * Validates flight ↔ hotel date alignment for a candidate trip.
 */

import type { RahhalFlightSearchOffer } from '../liveFlightSearch/types'
import type { HotelOffer } from '../liveHotelSearch/types'

export interface TripCompatibilityInput {
  flight: RahhalFlightSearchOffer
  hotel: HotelOffer
  departureDate: string
  returnDate: string | null
  checkInDate: string
  checkOutDate: string
  preferences?: {
    maxStops?: number | null
    minHotelStars?: number | null
    cabin?: string | null
  } | null
}

export interface TripCompatibilityResult {
  compatible: boolean
  errors: string[]
  nights: number
}

function dateOnly(iso: string | null | undefined): string | null {
  if (!iso || typeof iso !== 'string') return null
  const trimmed = iso.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime()
  const b = new Date(`${checkOut}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

export function assessTripCompatibility(
  input: TripCompatibilityInput,
): TripCompatibilityResult {
  const errors: string[] = []
  const nights = nightsBetween(input.checkInDate, input.checkOutDate)

  if (nights < 1) {
    errors.push('stay must be at least one night')
  }

  if (input.checkInDate < input.departureDate) {
    errors.push('hotel check-in precedes flight departure date')
  }

  if (input.returnDate && input.checkOutDate > input.returnDate) {
    errors.push('hotel check-out is after return date')
  }

  const flightArrival = dateOnly(input.flight.arrivalAt)
  const flightDeparture = dateOnly(input.flight.departureAt)

  if (flightDeparture && flightDeparture > input.checkInDate) {
    errors.push('flight departs after hotel check-in')
  }

  if (flightArrival && flightArrival > input.checkInDate) {
    // Same-day arrival after midnight still OK if arrival date equals check-in.
    // Reject only when arrival is strictly after check-in day.
    errors.push('flight arrives after hotel check-in date')
  }

  if (input.flight.origin && input.flight.destination) {
    const dest = input.flight.destination.toUpperCase()
    // Soft destination check — only warn via errors when obviously mismatched
    // with hotel city code-like tokens (kept as informational reject when hotel city is IATA).
    const hotelCity = input.hotel.city?.trim().toUpperCase() ?? null
    if (hotelCity && hotelCity.length === 3 && hotelCity !== dest && hotelCity !== dest.slice(0, 3)) {
      // Do not hard-fail city name mismatches (e.g. "Dubai" vs "DXB") — only IATA-like.
      if (/^[A-Z]{3}$/.test(hotelCity)) {
        errors.push('hotel city code does not match flight destination')
      }
    }
  }

  if (input.flight.price == null || !Number.isFinite(input.flight.price) || input.flight.price < 0) {
    errors.push('flight price is missing or invalid')
  }

  if (input.hotel.price == null || !Number.isFinite(input.hotel.price) || input.hotel.price < 0) {
    errors.push('hotel price is missing or invalid')
  }

  const prefs = input.preferences
  if (prefs?.maxStops != null && input.flight.stops != null) {
    if (input.flight.stops > prefs.maxStops) {
      errors.push(`flight exceeds maxStops (${prefs.maxStops})`)
    }
  }

  if (prefs?.minHotelStars != null && input.hotel.stars != null) {
    if (input.hotel.stars < prefs.minHotelStars) {
      errors.push(`hotel below minHotelStars (${prefs.minHotelStars})`)
    }
  }

  if (prefs?.cabin && input.flight.cabin) {
    const wanted = prefs.cabin.toLowerCase().replace(/[\s-]/g, '_')
    const got = input.flight.cabin.toLowerCase().replace(/[\s-]/g, '_')
    if (wanted && got && wanted !== got && !got.includes(wanted) && !wanted.includes(got)) {
      errors.push(`cabin mismatch (wanted ${prefs.cabin})`)
    }
  }

  return {
    compatible: errors.length === 0,
    errors,
    nights,
  }
}

export class TripCompatibility {
  assess(input: TripCompatibilityInput): TripCompatibilityResult {
    return assessTripCompatibility(input)
  }
}

export function createTripCompatibility(): TripCompatibility {
  return new TripCompatibility()
}
