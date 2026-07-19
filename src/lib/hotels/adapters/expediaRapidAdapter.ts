/**
 * Sprint 30 — Expedia Rapid sandbox adapter (no production credentials).
 */

import { createSandboxHotelProvider } from '../createSandboxHotelProvider'
import type { HotelProvider } from '../HotelProvider'
import type { HotelProviderMetadata } from '../types'

export const EXPEDIA_RAPID_PROVIDER_ID = 'expedia_rapid' as const

const METADATA: HotelProviderMetadata = {
  id: EXPEDIA_RAPID_PROVIDER_ID,
  displayName: 'Expedia Rapid',
  priority: 85,
  reliability: 0.88,
  mode: 'sandbox',
  version: '1.0.0',
}

export function createExpediaRapidAdapter(options?: {
  delayMs?: number
  failWith?: Parameters<typeof createSandboxHotelProvider>[0]['failWith']
}): HotelProvider {
  return createSandboxHotelProvider({
    metadata: METADATA,
    brand: 'Expedia',
    rateLimitPerMinute: 60,
    delayMs: options?.delayMs,
    failWith: options?.failWith,
  })
}
