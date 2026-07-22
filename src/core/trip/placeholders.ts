/**
 * Sprint 93 — placeholder providers for domains not yet live-integrated.
 */

import type {
  TripActivity,
  TripHotel,
  TripInsurance,
  TripTransfer,
  TripVisa,
} from './types'

export function placeholderHotel(input: {
  destination: string | null
  checkIn: string | null
  checkOut: string | null
  currency: string
}): TripHotel {
  return {
    id: 'placeholder_hotel',
    name: `${input.destination ?? 'City'} Stay (placeholder)`,
    destination: input.destination,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights: null,
    stars: 4,
    rating: 8.0,
    price: 0,
    currency: input.currency,
    providerId: 'placeholder',
    confidence: 0.35,
  }
}

export function placeholderTransfer(input: {
  destination: string | null
  startAt: string | null
  currency: string
}): TripTransfer {
  return {
    id: 'placeholder_transfer',
    title: 'Airport transfer (placeholder)',
    from: 'Airport',
    to: input.destination,
    startAt: input.startAt,
    durationMinutes: 40,
    price: 0,
    currency: input.currency,
    providerId: 'placeholder',
  }
}

export function placeholderActivity(input: {
  destination: string | null
  startAt: string | null
  currency: string
}): TripActivity {
  return {
    id: 'placeholder_activity',
    title: 'City highlights (placeholder)',
    startAt: input.startAt,
    endAt: null,
    price: 0,
    currency: input.currency,
    destination: input.destination,
    providerId: 'placeholder',
  }
}

export function placeholderInsurance(input: { currency: string }): TripInsurance {
  return {
    id: 'placeholder_insurance',
    title: 'Travel insurance (placeholder)',
    price: 0,
    currency: input.currency,
    coverage: 'Standard trip protection — confirm before booking',
    providerId: 'placeholder',
  }
}

export function placeholderVisa(input: {
  destination: string | null
  currency: string
}): TripVisa {
  return {
    id: 'placeholder_visa',
    required: false,
    destination: input.destination,
    summary: 'Visa requirements not verified yet — confirm for your nationality.',
    estimatedFee: 0,
    currency: input.currency,
    providerId: 'placeholder',
  }
}
