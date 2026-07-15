import { createAggregationEngine } from './engine'
import { createDefaultMockProviderAdapters } from './mockProviders'
import { createProviderRegistry } from './providerRegistry'
import type { AggregationEngine, ProviderAdapter, ProviderRegistry } from './types'

export function createDefaultProviderRegistry(
  adapters: ProviderAdapter[] = createDefaultMockProviderAdapters(),
): ProviderRegistry {
  return createProviderRegistry(adapters)
}

export function createDefaultAggregationEngine(
  registry: ProviderRegistry = createDefaultProviderRegistry(),
): AggregationEngine {
  return createAggregationEngine({ registry })
}
