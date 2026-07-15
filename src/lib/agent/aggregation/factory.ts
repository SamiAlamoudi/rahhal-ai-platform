import { createAggregationEngine } from './engine'
import {
  createActiveMockProviderAdapters,
  createDefaultMockProviderAdapters,
} from './mockProviders'
import { createAmadeusProviderAdapter } from './providers/amadeus'
import { createBookingComProviderAdapter } from './providers/booking'
import { createGoogleMapsProviderAdapter } from './providers/googleMaps'
import { createProviderRegistry } from './providerRegistry'
import type { AggregationEngine, ProviderAdapter, ProviderRegistry } from './types'

/**
 * Full default provider set for the Travel Agent:
 * Amadeus / Booking.com / Google Maps (real, when configured) → mock fallbacks + other domain mocks.
 */
export function createDefaultProviderAdapters(): ProviderAdapter[] {
  return [
    createAmadeusProviderAdapter(),
    createBookingComProviderAdapter(),
    createGoogleMapsProviderAdapter(),
    ...createDefaultMockProviderAdapters(),
  ]
}

export function createDefaultProviderRegistry(
  adapters: ProviderAdapter[] = createDefaultProviderAdapters(),
): ProviderRegistry {
  return createProviderRegistry(adapters)
}

/** Registry with only active mock adapters (no live Amadeus, no future stubs). */
export function createActiveMockProviderRegistry(
  adapters: ProviderAdapter[] = createActiveMockProviderAdapters(),
): ProviderRegistry {
  return createProviderRegistry(adapters)
}

export function createDefaultAggregationEngine(
  registry: ProviderRegistry = createDefaultProviderRegistry(),
): AggregationEngine {
  return createAggregationEngine({
    registry,
    selectionStrategy: 'parallel',
  })
}
