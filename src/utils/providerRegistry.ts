import type {
  SearchProvider,
  SearchProviderType,
  ProviderAdapter,
} from './searchOrchestrator'

export interface RegisteredProvider {
  provider: SearchProvider
  adapter: ProviderAdapter
  registeredAt: string
}

export interface ProviderSearchFilter {
  type?: SearchProviderType
  enabledOnly?: boolean
}

export interface ProviderRegistry {
  registerProvider(provider: SearchProvider, adapter: ProviderAdapter): void
  unregisterProvider(providerId: string): boolean
  enableProvider(providerId: string): boolean
  disableProvider(providerId: string): boolean
  listProviders(filter?: ProviderSearchFilter): SearchProvider[]
  searchProviders(filter?: ProviderSearchFilter): RegisteredProvider[]
  getProvider(providerId: string): RegisteredProvider | null
  clear(): void
}

export function createProviderRegistry(): ProviderRegistry {
  const registry = new Map<string, RegisteredProvider>()

  function getEffectiveProvider(entry: RegisteredProvider): SearchProvider {
    return entry.provider
  }

  return {
    registerProvider(provider, adapter) {
      const existing = registry.get(provider.id)
      registry.set(provider.id, {
        provider: { ...provider },
        adapter,
        registeredAt: existing?.registeredAt ?? new Date().toISOString(),
      })
    },

    unregisterProvider(providerId) {
      return registry.delete(providerId)
    },

    enableProvider(providerId) {
      const entry = registry.get(providerId)
      if (!entry) return false
      entry.provider = { ...entry.provider, enabled: true }
      return true
    },

    disableProvider(providerId) {
      const entry = registry.get(providerId)
      if (!entry) return false
      entry.provider = { ...entry.provider, enabled: false }
      return true
    },

    listProviders(filter) {
      const all = Array.from(registry.values()).map(getEffectiveProvider)
      if (!filter) return all
      let result = all
      if (filter.type) {
        result = result.filter(p => p.type === filter.type)
      }
      if (filter.enabledOnly) {
        result = result.filter(p => p.enabled)
      }
      return result
    },

    searchProviders(filter) {
      const all = Array.from(registry.values()).map(entry => ({
        provider: getEffectiveProvider(entry),
        adapter: entry.adapter,
        registeredAt: entry.registeredAt,
      }))
      if (!filter) return all
      let result = all
      if (filter.type) {
        result = result.filter(r => r.provider.type === filter.type)
      }
      if (filter.enabledOnly) {
        result = result.filter(r => r.provider.enabled)
      }
      return result
    },

    getProvider(providerId) {
      const entry = registry.get(providerId)
      if (!entry) return null
      return {
        provider: getEffectiveProvider(entry),
        adapter: entry.adapter,
        registeredAt: entry.registeredAt,
      }
    },

    clear() {
      registry.clear()
    },
  }
}

export function sortProvidersByPriority(providers: SearchProvider[]): SearchProvider[] {
  return [...providers].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.id.localeCompare(b.id)
  })
}
