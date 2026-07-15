import { createProviderHealthTracker, type ProviderHealthTracker } from './health'
import { selectProviders } from './selection'
import type {
  AggregatableDomain,
  ProviderAdapter,
  ProviderFetchResult,
  ProviderHealthSnapshot,
  ProviderRegistry,
  ProviderSelectionOptions,
} from './types'

export interface CreateProviderRegistryOptions {
  healthTracker?: ProviderHealthTracker
}

export function createProviderRegistry(
  initial: ProviderAdapter[] = [],
  options: CreateProviderRegistryOptions = {},
): ProviderRegistry {
  const adapters = new Map<string, ProviderAdapter>()
  const health = options.healthTracker ?? createProviderHealthTracker()

  for (const adapter of initial) {
    adapters.set(String(adapter.metadata.id), decorateWithSharedHealth(adapter, health))
  }

  const registry: ProviderRegistry = {
    list() {
      return [...adapters.values()].map((a) => a.metadata)
    },
    get(id) {
      return adapters.get(id)
    },
    register(adapter) {
      adapters.set(String(adapter.metadata.id), decorateWithSharedHealth(adapter, health))
    },
    forDomain(domain: AggregatableDomain) {
      return [...adapters.values()]
        .filter((adapter) => adapter.supports(domain) && adapter.isAvailable())
        .sort((a, b) => b.metadata.priority - a.metadata.priority)
    },
    select(selection: ProviderSelectionOptions) {
      return selectProviders(registry, selection)
    },
    discoverCapabilities(domain) {
      return [...adapters.values()]
        .filter((adapter) => (domain ? adapter.supports(domain) : true))
        .map((adapter) => adapter.getCapabilities())
    },
    getHealthStatus(providerId) {
      if (providerId) return [health.snapshot(providerId)]
      const ids = [...adapters.keys()]
      return health.list(ids)
    },
    recordOutcome(providerId: string, result: ProviderFetchResult) {
      health.record(providerId, result)
    },
  }

  return registry
}

function decorateWithSharedHealth(
  adapter: ProviderAdapter,
  health: ProviderHealthTracker,
): ProviderAdapter {
  const id = String(adapter.metadata.id)
  return {
    ...adapter,
    getHealth() {
      return health.snapshot(id)
    },
  }
}

export type { ProviderHealthSnapshot }
