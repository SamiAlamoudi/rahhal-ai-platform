/**
 * Brief identical-search cache (safe, short TTL).
 */

import type { BilamoFlightSearchRequest, FlightSearchProviderResult } from './types'

const TTL_MS = 90_000
const store = new Map<string, { at: number; value: FlightSearchProviderResult }>()

export function flightSearchCacheKey(request: BilamoFlightSearchRequest): string {
  return [
    request.origin.toUpperCase(),
    request.destination.toUpperCase(),
    request.departureDate,
    request.returnDate || '',
    request.adults,
    request.children ?? 0,
    request.infants ?? 0,
    request.cabin || 'economy',
    request.directOnly ? '1' : '0',
    request.maxStops ?? '',
    (request.preferredAirlines || []).join(','),
    (request.currency || 'SAR').toUpperCase(),
  ].join('|')
}

export function getCachedFlightSearch(key: string): FlightSearchProviderResult | null {
  const hit = store.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key)
    return null
  }
  return hit.value
}

export function setCachedFlightSearch(key: string, value: FlightSearchProviderResult): void {
  store.set(key, { at: Date.now(), value })
}

/** @internal */
export function __resetBilamoFlightCacheForTests(): void {
  store.clear()
}
