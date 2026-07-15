import { createAggregationEngine } from './engine'
import {
  createActiveMockProviderAdapters,
  createDefaultMockProviderAdapters,
} from './mockProviders'
import { createAmadeusProviderAdapter } from './providers/amadeus'
import { createProviderRegistry } from './providerRegistry'
import type { AggregationEngine, ProviderAdapter, ProviderRegistry } from './types'

/**
 * Full default provider set for the Travel Agent:
 * Amadeus (real, when configured) → mock flights fallback + other domain mocks.
 */
export function createDefaultProviderAdapters(): ProviderAdapter[] {
  return [
    createAmadeusProviderAdapter(),
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
