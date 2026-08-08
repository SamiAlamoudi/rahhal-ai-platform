/**
 * Hard gate for flight origin/destination before cards render.
 * Never invent IATA via slice; never recommend same-city / same-metro hops.
 */

import { resolveAirportCode } from '../../agent/airportCodes'

/** Codes that share a metro / city context where flying is nonsensical. */
const METRO_BY_CODE: Record<string, string> = {
  RUH: 'riyadh',
  RIY: 'riyadh',
  DXB: 'dubai',
  DWC: 'dubai',
  SHJ: 'dubai',
  LHR: 'london',
  LGW: 'london',
  STN: 'london',
  LCY: 'london',
  CDG: 'paris',
  ORY: 'paris',
  BVA: 'paris',
  HND: 'tokyo',
  NRT: 'tokyo',
  FCO: 'rome',
  CIA: 'rome',
  IST: 'istanbul',
  SAW: 'istanbul',
}

/** Canonical IATA aliases (fake / nonstandard → real). */
const CODE_ALIASES: Record<string, string> = {
  RIY: 'RUH',
}

export function canonicalizeAirportCode(code: string | null | undefined): string | null {
  const raw = (code || '').trim().toUpperCase()
  if (!raw || raw === 'XXX') return null
  if (!/^[A-Z]{3}$/.test(raw)) return null
  return CODE_ALIASES[raw] || raw
}

export function resolveDestinationAirport(destination: string | null | undefined): string | null {
  if (!destination?.trim()) return null
  const trimmed = destination.trim()
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return canonicalizeAirportCode(trimmed)
  }
  const resolved = resolveAirportCode(trimmed)
  return canonicalizeAirportCode(resolved)
}

export function resolveOriginAirport(
  origin: string | null | undefined,
  fallback = 'RUH',
): string | null {
  if (!origin?.trim()) return canonicalizeAirportCode(fallback)
  const trimmed = origin.trim()
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return canonicalizeAirportCode(trimmed)
  }
  const resolved = resolveAirportCode(trimmed)
  const code = canonicalizeAirportCode(resolved)
  return code || canonicalizeAirportCode(fallback)
}

export function metroKeyForAirport(code: string | null | undefined): string | null {
  const canon = canonicalizeAirportCode(code)
  if (!canon) return null
  return METRO_BY_CODE[canon] || canon.toLowerCase()
}

export type FlightRouteValidation =
  | { ok: true; origin: string; destination: string }
  | {
      ok: false
      reason:
        | 'missing_origin'
        | 'missing_destination'
        | 'invalid_airport'
        | 'same_airport'
        | 'same_city'
        | 'same_metro'
      origin: string | null
      destination: string | null
    }

export function validateFlightRoute(
  originRaw: string | null | undefined,
  destinationRaw: string | null | undefined,
): FlightRouteValidation {
  const origin = typeof originRaw === 'string' && /^[A-Za-z]{3}$/.test(originRaw.trim())
    ? canonicalizeAirportCode(originRaw)
    : resolveOriginAirport(originRaw)
  const destination = typeof destinationRaw === 'string' && /^[A-Za-z]{3}$/.test(destinationRaw.trim())
    ? canonicalizeAirportCode(destinationRaw)
    : resolveDestinationAirport(destinationRaw)

  if (!origin) {
    return { ok: false, reason: 'missing_origin', origin: null, destination }
  }
  if (!destination) {
    return { ok: false, reason: 'missing_destination', origin, destination: null }
  }
  if (origin === destination) {
    return { ok: false, reason: 'same_airport', origin, destination }
  }
  const oMetro = metroKeyForAirport(origin)
  const dMetro = metroKeyForAirport(destination)
  if (oMetro && dMetro && oMetro === dMetro) {
    return {
      ok: false,
      reason: oMetro === origin.toLowerCase() ? 'same_city' : 'same_metro',
      origin,
      destination,
    }
  }
  return { ok: true, origin, destination }
}

export function isValidRenderableFlight(offer: {
  origin?: string | null
  destination?: string | null
}): boolean {
  return validateFlightRoute(offer.origin, offer.destination).ok
}
