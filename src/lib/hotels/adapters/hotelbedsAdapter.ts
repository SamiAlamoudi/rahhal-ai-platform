/**
 * Sprint 30 — Hotelbeds sandbox adapter (no production credentials).
 */

import { createSandboxHotelProvider } from '../createSandboxHotelProvider'
import type { HotelProvider } from '../HotelProvider'
import type { HotelProviderMetadata } from '../types'

export const HOTELBEDS_PROVIDER_ID = 'hotelbeds' as const

const METADATA: HotelProviderMetadata = {
  id: HOTELBEDS_PROVIDER_ID,
  displayName: 'Hotelbeds',
  priority: 90,
  reliability: 0.9,
  mode: 'sandbox',
  version: '1.0.0',
}

export function createHotelbedsAdapter(options?: {
  delayMs?: number
  failWith?: Parameters<typeof createSandboxHotelProvider>[0]['failWith']
}): HotelProvider {
  return createSandboxHotelProvider({
    metadata: METADATA,
    brand: 'Hotelbeds',
    rateLimitPerMinute: 50,
    delayMs: options?.delayMs,
    failWith: options?.failWith,
  })
}
