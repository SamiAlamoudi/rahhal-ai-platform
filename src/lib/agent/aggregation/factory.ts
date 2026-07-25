import { createAggregationEngine } from './engine'
import {
  createActiveMockProviderAdapters,
} from './mockProviders'
import { createProviderRegistry } from './providerRegistry'
import type { AggregationEngine, ProviderAdapter, ProviderRegistry } from './types'

/**
 * RC-2 — default aggregation path is mock-only so tool registry / ChatPage cold
 * start does not pull live Amadeus / Booking.com / Maps / Weather adapter modules.
 *
 * Live adapters: import from `./liveIntegration` (`createLiveIntegrationEngine`,
 * `createLiveProviderAdapters`) or use `createDefaultProviderAdapters()` in
 * `./defaultProviders.ts`.
 */

/** Registry with only active mock adapters (no live Amadeus, no future stubs). */
export function createActiveMockProviderRegistry(
  adapters: ProviderAdapter[] = createActiveMockProviderAdapters(),
): ProviderRegistry {
  return createProviderRegistry(adapters)
}

/**
 * Default engine — mock providers + priority_fallback.
 * For live+m mock Phase W registry, call `createLiveIntegrationEngine()` explicitly.
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
  return createAggregationEngine({
    registry: createActiveMockProviderRegistry(),
    selectionStrategy: 'priority_fallback',
  })
}
