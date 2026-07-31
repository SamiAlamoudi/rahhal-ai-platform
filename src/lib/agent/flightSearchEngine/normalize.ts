/**
 * Sprint 72 — Normalize provider offers → UnifiedFlight.
 */

import type { ProviderRuntimeId } from '../providerRuntime/types'
import type { FlightCabinClass, UnifiedFlight } from './types'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return fallback
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return fallback
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function normalizeCabin(raw: unknown): FlightCabinClass {
  const v = asString(raw, 'economy').toLowerCase()
  if (v.includes('first')) return 'first'
  if (v.includes('business')) return 'business'
  if (v.includes('premium')) return 'premium_economy'
  return 'economy'
}

function normalizeProvider(raw: unknown): ProviderRuntimeId {
  const v = asString(raw, 'mock').toLowerCase()
  if (v === 'amadeus' || v === 'duffel' || v === 'booking' || v === 'mock') return v
  if (v === 'simulated') return 'mock'
  return 'mock'
}

/** Map LiveFlightOffer-like or mock shapes into UnifiedFlight. */
export function normalizeFlightOffer(
  raw: unknown,
  fallbackProvider: ProviderRuntimeId = 'mock',
): UnifiedFlight | null {
  const o = asRecord(raw)
  const priceObj = asRecord(o.price)
  const provider = normalizeProvider(o.providerId ?? o.provider ?? fallbackProvider)
  const origin = asString(o.from ?? o.origin).toUpperCase()
  const destination = asString(o.to ?? o.destination).toUpperCase()
  if (!origin || !destination) return null

  const id = asString(o.id, `${provider}_${origin}_${destination}_${Date.now()}`)
  const airline = asString(o.airline, provider === 'mock' ? 'Saudia' : 'Unknown')
  const flightNumber = asString(
    o.flightNumber ?? o.flight_number,
    `${airline.slice(0, 2).toUpperCase()}${100 + (id.length % 800)}`,
  )
  const departureTime = asString(o.departureAt ?? o.departureTime, '2026-08-01T08:00:00Z')
  const arrivalTime = asString(o.arrivalAt ?? o.arrivalTime, '2026-08-01T11:00:00Z')
  const duration = asNumber(
    o.durationMinutes ?? o.duration,
    Math.max(60, Math.round((Date.parse(arrivalTime) - Date.parse(departureTime)) / 60_000) || 180),
  )
  const price = asNumber(priceObj.amount ?? o.price, provider === 'mock' ? 450 : 0)
  const currency = asString(priceObj.currency ?? o.currency, 'SAR')

  return {
    id,
    provider,
    airline,
    flightNumber,
    origin,
    destination,
    departureTime,
    arrivalTime,
    duration,
    stops: asNumber(o.stops, 0),
    cabin: normalizeCabin(o.cabin),
    fareFamily: asString(o.fareFamily ?? o.fare_family, 'standard'),
    price,
    currency,
    baggage: (() => {
      if (o.baggage == null) return provider === 'mock' ? '1 PC' : null
      const b = asString(o.baggage)
      return b || null
    })(),
    refundable: asBool(o.refundable, provider === 'mock'),
    bookingToken: asString(o.bookingToken ?? o.booking_token, `bt_${id}`),
    providerMetadata: {
      rawId: id,
      mode: o.mode ?? null,
      source: provider,
    },
  }
}

export function normalizeFlightOffers(
  offers: unknown[],
  fallbackProvider: ProviderRuntimeId,
): UnifiedFlight[] {
  const out: UnifiedFlight[] = []
  for (const offer of offers) {
    const normalized = normalizeFlightOffer(offer, fallbackProvider)
    if (normalized) out.push(normalized)
  }
  return out
}

export function enrichMockFlight(
  partial: Partial<UnifiedFlight> & Pick<UnifiedFlight, 'origin' | 'destination'>,
  index = 0,
): UnifiedFlight {
  const id = partial.id ?? `mock_flight_${partial.origin}_${partial.destination}_${index}`
  return {
    id,
    provider: 'mock',
    airline: partial.airline ?? (['Saudia', 'flynas', 'Emirates'][index % 3] ?? 'Saudia'),
    flightNumber: partial.flightNumber ?? `SV${100 + index}`,
    origin: partial.origin.toUpperCase(),
    destination: partial.destination.toUpperCase(),
    departureTime: partial.departureTime ?? `2026-08-01T0${8 + (index % 2)}:00:00Z`,
    arrivalTime: partial.arrivalTime ?? `2026-08-01T1${1 + (index % 2)}:30:00Z`,
    duration: partial.duration ?? (150 + index * 30),
    stops: partial.stops ?? (index % 3 === 0 ? 0 : 1),
    cabin: partial.cabin ?? 'economy',
    fareFamily: partial.fareFamily ?? 'standard',
    price: partial.price ?? (400 + index * 75),
    currency: partial.currency ?? 'SAR',
    baggage: partial.baggage ?? '1 PC',
    refundable: partial.refundable ?? index % 2 === 0,
    bookingToken: partial.bookingToken ?? `bt_${id}`,
    providerMetadata: partial.providerMetadata ?? { source: 'mock' },
  }
}
