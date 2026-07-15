import { createAggregationEngine } from './engine'
import {
  createLiveIntegration,
  createLiveIntegrationEngine,
  createLiveProviderAdapters,
  createLiveProviderRegistry,
  resolveProviderFeatureFlags,
} from './liveIntegration'
import {
  createActiveMockProviderAdapters,
} from './mockProviders'
import { createProviderRegistry } from './providerRegistry'
import type { AggregationEngine, ProviderAdapter, ProviderRegistry } from './types'

/**
 * Full default provider set for the Travel Agent:
 * Amadeus / Booking.com / Google Maps / OpenWeather (real, when configured)
 * → mock fallbacks + other domain mocks.
 *
 * Phase W: live adapters honor feature flags; mock counterparts remain for fallback.
 */
export function createDefaultProviderAdapters(): ProviderAdapter[] {
  const flags = resolveProviderFeatureFlags()
  return createLiveProviderAdapters(flags)
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

/**
 * Default engine — Phase W priority_fallback so live failures auto-route to mocks.
 * Use `createAggregationEngine({ selectionStrategy: 'parallel' })` for fan-out queries.
 */
export function createDefaultAggregationEngine(
  registry?: ProviderRegistry,
): AggregationEngine {
  if (registry) {
    return createAggregationEngine({
      registry,
      selectionStrategy: 'priority_fallback',
    })
  }
  return createLiveIntegrationEngine()
}

export {
  createLiveIntegration,
  createLiveIntegrationEngine,
  createLiveProviderRegistry,
  createLiveProviderAdapters,
}
