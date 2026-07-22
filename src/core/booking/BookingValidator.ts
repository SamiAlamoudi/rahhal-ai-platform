/**
 * Sprint 94 — pre-booking validation.
 */

import type { BookableTraveler, BookableTrip } from './types'

export interface BookingValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export function validateBooking(input: {
  trip: BookableTrip
  travelers: BookableTraveler[]
  quotedTotal: number
  currentTotal: number
  currency: string
  now: number
  expiresAt: string
  providerHealthy: boolean
}): BookingValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (input.trip.valid === false) {
    errors.push('Trip is not valid for booking')
  }

  if (!input.trip.flights?.length) {
    errors.push('Missing flights')
  }

  const quoted = round(input.quotedTotal)
  const current = round(input.currentTotal)
  if (Math.abs(quoted - current) > 0.009) {
    errors.push('price unchanged check failed')
  }

  if (!input.currency || input.currency.length !== 3) {
    errors.push('Invalid currency')
  } else if (input.trip.currency && input.trip.currency.toUpperCase() !== input.currency.toUpperCase()) {
    errors.push('Currency mismatch')
  }

  for (const flight of input.trip.flights ?? []) {
    if (flight.currency && flight.currency.toUpperCase() !== input.currency.toUpperCase()) {
      errors.push('Currency mismatch')
      break
    }
  }

  if (!input.travelers.length) {
    errors.push('Missing traveler data')
  } else {
    for (const t of input.travelers) {
      if (!t.firstName?.trim() || !t.lastName?.trim()) {
        errors.push('Incomplete traveler data')
        break
      }
    }
  }

  const expires = Date.parse(input.expiresAt)
  if (Number.isFinite(expires) && input.now > expires) {
    errors.push('Booking timeout')
  }

  if (!input.providerHealthy) {
    errors.push('Provider unhealthy')
  }

  // Soft availability warning when confidence is low
  for (const flight of input.trip.flights ?? []) {
    if (typeof flight.confidence === 'number' && flight.confidence < 0.4) {
      warnings.push(`Low availability confidence for flight ${flight.id}`)
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
