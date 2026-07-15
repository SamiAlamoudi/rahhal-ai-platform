import type { AggregatableDomain, ProviderAdapter, ProviderRegistry } from './types'

export function createProviderRegistry(initial: ProviderAdapter[] = []): ProviderRegistry {
  const adapters = new Map<string, ProviderAdapter>()
  for (const adapter of initial) adapters.set(adapter.metadata.id, adapter)

  return {
    list() {
      return [...adapters.values()].map((a) => a.metadata)
    },
    get(id) {
      return adapters.get(id)
    },
    register(adapter) {
      adapters.set(adapter.metadata.id, adapter)
    },
    forDomain(domain: AggregatableDomain) {
      return [...adapters.values()]
        .filter((adapter) => adapter.supports(domain) && adapter.isAvailable())
        .sort((a, b) => b.metadata.priority - a.metadata.priority)
    },
  }
}
