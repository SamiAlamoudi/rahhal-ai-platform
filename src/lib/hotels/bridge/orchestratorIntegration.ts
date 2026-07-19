/**
 * Sprint 30 — Orchestrator + conversation memory integration helpers.
 */

import type { HotelSearchRequest } from '../types'
import {
  createHotelProviderRegistry,
  type HotelProviderRegistry,
} from '../HotelProviderRegistry'
import type { HotelUnifiedSearchResult } from '../types'

/** Minimal working-memory shape used by Sprint 28 ContextAssembler / orchestrator. */
export interface HotelMemoryHints {
  preferredHotels?: string[]
  hotelPreferences?: string[]
  destination?: string | null
  startDate?: string | null
  endDate?: string | null
  adults?: number | null
  children?: number | null
  currency?: string | null
  budgetAmount?: number | null
}

/**
 * Build a hotel search request from orchestrator / memory working context.
 */
export function hotelSearchRequestFromMemory(
  hints: HotelMemoryHints,
  overrides: Partial<HotelSearchRequest> = {},
): HotelSearchRequest {
  const preferred = [
    ...(hints.preferredHotels ?? []),
    ...(hints.hotelPreferences ?? []),
  ]
  return {
    destination: overrides.destination || hints.destination || 'City',
    checkIn: overrides.checkIn || hints.startDate || daysFromToday(14),
    checkOut: overrides.checkOut || hints.endDate || daysFromToday(17),
    adults: overrides.adults ?? Math.max(1, hints.adults ?? 2),
    children: overrides.children ?? hints.children ?? undefined,
    currency: overrides.currency || hints.currency || 'SAR',
    preferredHotels: overrides.preferredHotels ?? preferred,
    maxResults: overrides.maxResults ?? 6,
  }
}

/**
 * Run unified hotel search using memory/orchestrator hints.
 */
export async function searchHotelsForOrchestrator(
  hints: HotelMemoryHints,
  options?: {
    registry?: HotelProviderRegistry
    overrides?: Partial<HotelSearchRequest>
  },
): Promise<HotelUnifiedSearchResult> {
  const registry = options?.registry ?? createHotelProviderRegistry()
  const req = hotelSearchRequestFromMemory(hints, options?.overrides)
  return registry.search(req, { failover: true })
}

/**
 * Rank offers with a soft boost when the name matches remembered hotel brands.
 */
export function applyHotelMemoryPreferenceBoost<T extends { name: string }>(
  offers: T[],
  preferredHotels: string[] | undefined,
): T[] {
  if (!preferredHotels?.length) return offers
  const prefs = preferredHotels.map((p) => p.toLowerCase())
  return [...offers].sort((a, b) => {
    const aHit = prefs.some((p) => a.name.toLowerCase().includes(p)) ? 1 : 0
    const bHit = prefs.some((p) => b.name.toLowerCase().includes(p)) ? 1 : 0
    return bHit - aHit
  })
}

function daysFromToday(offset: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
