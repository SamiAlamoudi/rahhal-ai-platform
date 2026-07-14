import type { ProviderDomain, ProviderMetadata } from '../metadata'
import type {
  FlightProvider,
  HotelProvider,
  ActivityProvider,
  TransferProvider,
  VisaProvider,
  WeatherProvider,
  DestinationProvider,
} from '../providers'
import { getProviderRegistry } from '../../../integrations/registry/providerRegistry'
import { createMockContractProviders } from '../mocks'

export type AnyProvider =
  | FlightProvider
  | HotelProvider
  | ActivityProvider
  | TransferProvider
  | VisaProvider
  | WeatherProvider
  | DestinationProvider

export interface ContractRegistry {
  register(provider: AnyProvider): void
  unregister(providerId: string): boolean
  enable(providerId: string): boolean
  disable(providerId: string): boolean
  getByDomain(domain: ProviderDomain): AnyProvider[]
  getById(providerId: string): AnyProvider | null
  listAll(): AnyProvider[]
  listEnabled(): AnyProvider[]
  getMetadata(providerId: string): ProviderMetadata | null
  clear(): void
}

export function createContractRegistry(): ContractRegistry {
  const providers = new Map<string, AnyProvider>()

  return {
    register(provider) {
      providers.set(provider.metadata.id, provider)
    },

    unregister(providerId) {
      return providers.delete(providerId)
    },

    enable(providerId) {
      const p = providers.get(providerId)
      if (!p) return false
      const meta = p.metadata
      if (meta.enabled) return true
      Object.defineProperty(p, 'metadata', {
        value: { ...meta, enabled: true },
        writable: true,
        configurable: true,
      })
      return true
    },

    disable(providerId) {
      const p = providers.get(providerId)
      if (!p) return false
      const meta = p.metadata
      if (!meta.enabled) return true
      Object.defineProperty(p, 'metadata', {
        value: { ...meta, enabled: false },
        writable: true,
        configurable: true,
      })
      return true
    },

    getByDomain(domain) {
      return Array.from(providers.values()).filter(p => p.metadata.type === domain)
    },

    getById(providerId) {
      return providers.get(providerId) ?? null
    },

    listAll() {
      return Array.from(providers.values())
    },

    listEnabled() {
      return Array.from(providers.values()).filter(p => p.metadata.enabled)
    },

    getMetadata(providerId) {
      return providers.get(providerId)?.metadata ?? null
    },

    clear() {
      providers.clear()
    },
  }
}

export function createDefaultContractRegistry(): ContractRegistry {
  const registry = createContractRegistry()
  const mocks = createMockContractProviders()
  registry.register(mocks.flight)
  registry.register(mocks.hotel)
  registry.register(mocks.activity)
  registry.register(mocks.transfer)
  registry.register(mocks.visa)
  const integrationWeather = lookupIntegrationWeatherProvider()
  registry.register(integrationWeather ?? mocks.weather)
  registry.register(mocks.destination)
  return registry
}

function lookupIntegrationWeatherProvider(): WeatherProvider | null {
  try {
    const reg = getProviderRegistry()
    const provider = reg.getWeather()
    return provider as unknown as WeatherProvider | null
  } catch {
    return null
  }
}
