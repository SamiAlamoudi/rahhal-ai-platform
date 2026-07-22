/**
 * Sprint 106 — map raw / decision-shaped offers into ResponseComposerFlightFacts.
 * Drops invalid rows; never invents missing provider fields.
 */

import type {
  ResponseComposerFlightFacts,
  ResponseComposerInput,
} from './types'

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function bool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  return null
}

function hourFromIso(iso: string | null): number | null {
  if (!iso) return null
  const match = /T(\d{2})/.exec(iso)
  if (!match) return null
  const h = Number(match[1])
  return Number.isFinite(h) ? h : null
}

/** Map a loose offer record (gateway raw / decision flight facts) → composer facts. */
export function mapLooseOfferToFlightFacts(
  raw: Record<string, unknown>,
  index: number,
): ResponseComposerFlightFacts | null {
  const id = str(raw.id) ?? `offer_${index}`
  const price = num(raw.price) ?? num(raw.totalPrice)
  const origin = str(raw.origin) ?? str(raw.from)
  const destination = str(raw.destination) ?? str(raw.to)

  // Invalid: no identity and no route/price signal at all
  if (!str(raw.id) && price == null && !origin && !destination && !str(raw.airline)) {
    return null
  }

  const departureAt = str(raw.departureAt) ?? str(raw.departureTime)
  const arrivalAt = str(raw.arrivalAt) ?? str(raw.arrivalTime)
  const departureHour = num(raw.departureHour) ?? hourFromIso(departureAt)
  const arrivalHour = num(raw.arrivalHour) ?? hourFromIso(arrivalAt)

  return {
    id,
    providerId: str(raw.providerId),
    title: str(raw.title),
    airline: str(raw.airline) ?? str(raw.carrierCode),
    origin,
    destination,
    price,
    currency: (str(raw.currency) ?? 'SAR').toUpperCase(),
    durationMinutes: num(raw.durationMinutes) ?? num(raw.duration),
    stops: num(raw.stops),
    layoverMinutes: num(raw.layoverMinutes),
    cabin: str(raw.cabin),
    departureAt,
    arrivalAt,
    departureHour,
    arrivalHour,
    refundable: bool(raw.refundable),
    baggageIncluded: bool(raw.baggageIncluded),
    seatsRemaining: num(raw.seatsRemaining),
    score: num(raw.score) ?? num(raw.providerConfidence),
  }
}

export function mapDecisionCandidateToFlightFacts(
  candidate: {
    id: string
    providerId?: string
    title?: string
    totalPrice?: number
    currency?: string
    score?: { overall?: number } | null
    flight?: {
      id?: string
      providerId?: string
      airline?: string
      price?: number
      currency?: string
      durationMinutes?: number | null
      stops?: number
      layoverMinutes?: number | null
      departureHour?: number | null
      arrivalHour?: number | null
      cabin?: string | null
      baggageIncluded?: boolean
      refundable?: boolean
      payload?: Record<string, unknown>
    }
  },
): ResponseComposerFlightFacts {
  const f = candidate.flight
  const departureAt = f?.payload ? str(f.payload.departureAt) : null
  const arrivalAt = f?.payload ? str(f.payload.arrivalAt) : null
  return {
    id: candidate.id,
    providerId: candidate.providerId ?? f?.providerId ?? null,
    title: candidate.title ?? null,
    airline: f?.airline ?? null,
    origin: f?.payload ? str(f.payload.origin) : null,
    destination: f?.payload ? str(f.payload.destination) : null,
    price: candidate.totalPrice ?? f?.price ?? null,
    currency: (candidate.currency ?? f?.currency ?? 'SAR').toUpperCase(),
    durationMinutes: f?.durationMinutes ?? null,
    stops: f?.stops ?? null,
    layoverMinutes: f?.layoverMinutes ?? null,
    cabin: f?.cabin ?? null,
    departureAt,
    arrivalAt,
    departureHour: f?.departureHour ?? null,
    arrivalHour: f?.arrivalHour ?? null,
    refundable: f?.refundable ?? null,
    baggageIncluded: f?.baggageIncluded ?? null,
    seatsRemaining: f?.payload ? num(f.payload.seatsRemaining) : null,
    score: candidate.score?.overall ?? null,
  }
}

export function normalizeComposerFlights(
  input: ResponseComposerInput,
): ResponseComposerFlightFacts[] {
  const fromInput = (input.flights ?? []).filter((f): f is ResponseComposerFlightFacts =>
    Boolean(f && typeof f === 'object' && typeof f.id === 'string' && f.id.trim()),
  )

  return fromInput.map((f) => ({
    ...f,
    currency: (f.currency ?? 'SAR').toUpperCase(),
    price: f.price != null && Number.isFinite(f.price) ? f.price : null,
    durationMinutes:
      f.durationMinutes != null && Number.isFinite(f.durationMinutes)
        ? f.durationMinutes
        : null,
    stops: f.stops != null && Number.isFinite(f.stops) ? f.stops : null,
  }))
}

export function isValidComposerFlight(flight: ResponseComposerFlightFacts): boolean {
  if (!flight.id?.trim()) return false
  // Need at least a price or a route or airline to reason about
  return (
    flight.price != null
    || Boolean(flight.origin && flight.destination)
    || Boolean(flight.airline)
    || flight.durationMinutes != null
  )
}

export class ResponseComposerMapper {
  mapLoose(raw: Record<string, unknown>, index: number): ResponseComposerFlightFacts | null {
    return mapLooseOfferToFlightFacts(raw, index)
  }

  normalize(input: ResponseComposerInput): ResponseComposerFlightFacts[] {
    return normalizeComposerFlights(input).filter(isValidComposerFlight)
  }
}

export function createResponseComposerMapper(): ResponseComposerMapper {
  return new ResponseComposerMapper()
}
