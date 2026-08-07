/**
 * Sprint 30 — Mock hotel adapter (ultimate failover safety net).
 */

import { createSandboxHotelProvider } from '../createSandboxHotelProvider'
import type { HotelProvider } from '../HotelProvider'
import type { HotelProviderMetadata } from '../types'

export const MOCK_HOTELS_PROVIDER_ID = 'mock_hotels' as const

const METADATA: HotelProviderMetadata = {
  id: MOCK_HOTELS_PROVIDER_ID,
  displayName: 'Mock Hotels',
  priority: 10,
  reliability: 1,
  mode: 'mock',
  version: '1.0.0',
}

export function createMockHotelsAdapter(options?: {
  delayMs?: number
  failWith?: Parameters<typeof createSandboxHotelProvider>[0]['failWith']
}): HotelProvider {
  return createSandboxHotelProvider({
    metadata: METADATA,
    brand: 'Bilamo Mock',
    rateLimitPerMinute: 120,
    delayMs: options?.delayMs,
    failWith: options?.failWith,
  })
}
