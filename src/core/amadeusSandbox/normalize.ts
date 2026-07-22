/**
 * Sprint 92 — Amadeus → Rahhal flight / airport / airline normalization.
 */

import type { AmadeusAirportLookup, AmadeusNormalizedFlight } from './types'
import { AMADEUS_SANDBOX_PROVIDER_ID } from './types'

/** Common IATA airline code → display name (sandbox-friendly subset). */
export const AMADEUS_AIRLINE_NAMES: Record<string, string> = {
  SV: 'Saudia',
  XY: 'Flynas',
  F3: 'Flyadeal',
  EK: 'Emirates',
  EY: 'Etihad Airways',
  QR: 'Qatar Airways',
  BA: 'British Airways',
  AF: 'Air France',
  LH: 'Lufthansa',
  TK: 'Turkish Airlines',
  MS: 'EgyptAir',
  RJ: 'Royal Jordanian',
  G9: 'Air Arabia',
  FZ: 'flydubai',
  AA: 'American Airlines',
  UA: 'United Airlines',
  DL: 'Delta Air Lines',
}

const CABIN_MAP: Record<string, string> = {
  economy: 'ECONOMY',
  eco: 'ECONOMY',
  y: 'ECONOMY',
  premium_economy: 'PREMIUM_ECONOMY',
  premiumeconomy: 'PREMIUM_ECONOMY',
  premium: 'PREMIUM_ECONOMY',
  w: 'PREMIUM_ECONOMY',
  business: 'BUSINESS',
  j: 'BUSINESS',
  first: 'FIRST',
  f: 'FIRST',
}

export type AmadeusOfferRaw = {
  id?: string
  type?: string
  source?: string
  numberOfBookableSeats?: number
  itineraries?: Array<{
    duration?: string
    segments?: Array<{
      departure?: { iataCode?: string; at?: string }
      arrival?: { iataCode?: string; at?: string }
      carrierCode?: string
      numberOfStops?: number
      duration?: string
      aircraft?: { code?: string }
    }>
  }>
  price?: { total?: string; currency?: string; grandTotal?: string }
  travelerPricings?: Array<{ fareDetailsBySegment?: Array<{ cabin?: string }> }>
  pricingOptions?: { refundableFare?: boolean }
}

export function mapCabinToAmadeusTravelClass(cabin: string | null | undefined): string | null {
  if (!cabin) return null
  const key = cabin.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return CABIN_MAP[key] ?? (key.length > 0 ? key.toUpperCase() : null)
}

export function mapAirlineCode(code: string | null | undefined): string | null {
  if (!code) return null
  const normalized = code.trim().toUpperCase()
  return AMADEUS_AIRLINE_NAMES[normalized] ?? normalized
}

export function normalizeCurrency(code: string | null | undefined, fallback = 'SAR'): string {
  const c = (code ?? fallback).trim().toUpperCase()
  return /^[A-Z]{3}$/.test(c) ? c : fallback
}

export function normalizePassengerCounts(input: {
  adults?: number
  children?: number
}): { adults: number; children: number } {
  const adults = Math.max(1, Math.floor(input.adults ?? 1))
  const children = Math.max(0, Math.floor(input.children ?? 0))
  return { adults, children }
}

export function parseDurationMinutes(iso: string | undefined): number | null {
  if (!iso) return null
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(iso)
  if (!match) return null
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)
}

export function normalizeAmadeusFlightOffer(
  raw: AmadeusOfferRaw,
  index: number,
  passengers: { adults: number; children: number },
): AmadeusNormalizedFlight {
  const segments = raw.itineraries?.[0]?.segments ?? []
  const first = segments[0]
  const last = segments[segments.length - 1]
  const stops = Math.max(0, segments.length - 1)
  const airlineCode = first?.carrierCode ?? null
  const origin = (first?.departure?.iataCode || '').toUpperCase()
  const destination = (last?.arrival?.iataCode || '').toUpperCase()
  const seats = typeof raw.numberOfBookableSeats === 'number'
    ? raw.numberOfBookableSeats
    : null
  const priceTotal = Number(raw.price?.grandTotal ?? raw.price?.total ?? 0)

  return {
    id: raw.id || `amadeus-flight-${index}`,
    providerId: AMADEUS_SANDBOX_PROVIDER_ID,
    airline: airlineCode,
    airlineName: mapAirlineCode(airlineCode),
    origin,
    destination,
    price: Number.isFinite(priceTotal) ? priceTotal : 0,
    currency: normalizeCurrency(raw.price?.currency),
    durationMinutes: parseDurationMinutes(raw.itineraries?.[0]?.duration),
    stops,
    cabin: raw.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ?? null,
    departureAt: first?.departure?.at ?? null,
    arrivalAt: last?.arrival?.at ?? null,
    refundable: raw.pricingOptions?.refundableFare ?? null,
    seatsRemaining: seats,
    availability: seats == null
      ? 'unknown'
      : seats <= 3
        ? 'limited'
        : 'available',
    passengers: { ...passengers },
    airports: {
      origin: { iata: origin, name: null },
      destination: { iata: destination, name: null },
    },
    metadata: {
      source: 'amadeus_sandbox',
      offerType: raw.type ?? null,
      rawId: raw.id ?? null,
    },
  }
}

export function normalizeAmadeusAirport(row: {
  iataCode?: string
  name?: string
  address?: { cityName?: string; countryCode?: string }
}): AmadeusAirportLookup | null {
  if (!row.iataCode) return null
  return {
    iata: String(row.iataCode).toUpperCase(),
    name: row.name || String(row.iataCode),
    city: row.address?.cityName ?? null,
    country: row.address?.countryCode ?? null,
  }
}

/** Shape Decision Engine / Package Builder can consume from TravelProvider results. */
export function toDecisionEngineFlightOffer(
  flight: AmadeusNormalizedFlight,
): Record<string, unknown> {
  return {
    id: flight.id,
    providerId: flight.providerId,
    airline: flight.airlineName ?? flight.airline,
    carrierCode: flight.airline,
    price: flight.price,
    currency: flight.currency,
    durationMinutes: flight.durationMinutes,
    stops: flight.stops,
    cabin: flight.cabin,
    origin: flight.origin,
    destination: flight.destination,
    departureAt: flight.departureAt,
    arrivalAt: flight.arrivalAt,
    refundable: flight.refundable === true,
    seatsRemaining: flight.seatsRemaining,
    providerConfidence: 0.9,
    availability: flight.availability,
    payload: flight,
  }
}

/**
 * Additive adapter → Sprint 93 Unified Trip `flightOffers` / TripNormalizer input.
 * Does not modify TripComposer; callers pass the result into `composeUnifiedTrip`.
 */
export function toUnifiedTripFlightOffer(
  flight: AmadeusNormalizedFlight,
): Record<string, unknown> {
  const base = toDecisionEngineFlightOffer(flight)
  return {
    ...base,
    airline: flight.airlineName ?? flight.airline,
    providerConfidence: 0.9,
  }
}

/**
 * Additive adapter → Sprint 94 BookableTrip flight segment shape.
 * Prefer composing a Unified Trip then `toBookableTrip`; this maps a single Amadeus
 * flight when booking a flight-only hold without a full Trip composition.
 */
export function toBookableFlightSegment(
  flight: AmadeusNormalizedFlight,
): {
  id: string
  airline: string | null
  origin: string
  destination: string
  departureAt: string | null
  arrivalAt: string | null
  price: number
  currency: string
  providerId: string
  confidence: number
} {
  return {
    id: flight.id,
    airline: flight.airlineName ?? flight.airline,
    origin: flight.origin,
    destination: flight.destination,
    departureAt: flight.departureAt,
    arrivalAt: flight.arrivalAt,
    price: flight.price,
    currency: flight.currency,
    providerId: flight.providerId,
    confidence: 0.9,
  }
}

