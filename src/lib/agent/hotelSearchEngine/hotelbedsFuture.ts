/**
 * Sprint 73 — Future-ready Hotelbeds slot (no Provider Runtime changes).
 * Returns empty until a live adapter is registered.
 */

import type { HotelProviderId, UnifiedHotel } from './types'

export type HotelbedsFutureResult = {
  providerId: Extract<HotelProviderId, 'hotelbeds'>
  mode: 'future'
  hotels: UnifiedHotel[]
  latencyMs: number
  detail: string
}

/** Placeholder probe — always empty, never throws. */
export async function searchHotelbedsFuture(_input?: {
  city?: string
  signal?: AbortSignal
}): Promise<HotelbedsFutureResult> {
  const started = Date.now()
  return {
    providerId: 'hotelbeds',
    mode: 'future',
    hotels: [],
    latencyMs: Date.now() - started,
    detail: 'Hotelbeds adapter reserved — not registered in Provider Runtime yet',
  }
}
