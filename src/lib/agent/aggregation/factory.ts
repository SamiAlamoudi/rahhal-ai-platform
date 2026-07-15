import { createAggregationEngine } from './engine'
import {
  createActiveMockProviderAdapters,
  createDefaultMockProviderAdapters,
} from './mockProviders'
import { createProviderRegistry } from './providerRegistry'
import type { AggregationEngine, ProviderAdapter, ProviderRegistry } from './types'

export function createDefaultProviderRegistry(
  adapters: ProviderAdapter[] = createDefaultMockProviderAdapters(),
): ProviderRegistry {
  return createProviderRegistry(adapters)
}

/** Registry with only active mock adapters (no future stubs). */
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
