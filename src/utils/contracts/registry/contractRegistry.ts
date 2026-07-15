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
import {
  createMockContractProviders,
  type MockContractProviders,
} from '../mocks'

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

/**
 * Public default registry shape used by older contracts API / tests.
 * Also exposes method-based ContractRegistry accessors for current callers.
 */
export type DefaultContractRegistry = ContractRegistry & {
  flights: FlightProvider[]
  hotels: HotelProvider[]
  activities: ActivityProvider[]
  transfers: TransferProvider[]
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

/**
 * Build the default registry with mock providers.
 * Returns both domain arrays (`flights`/`hotels`/…) and method-based accessors
 * (`getByDomain`) so legacy and current callers stay compatible.
 */
export function createDefaultContractRegistry(
  providers: MockContractProviders = createMockContractProviders(),
): DefaultContractRegistry {
  const registry = hydrateContractRegistry(providers)
  return Object.assign(registry, {
    flights: [providers.flight],
    hotels: [providers.hotel],
    activities: [providers.activity],
    transfers: [providers.transfer],
  })
}

/** Populates a method-based ContractRegistry with all mock + integration providers. */
export function hydrateContractRegistry(
  providers: MockContractProviders = createMockContractProviders(),
): ContractRegistry {
  const registry = createContractRegistry()
  registry.register(providers.flight)
  registry.register(providers.hotel)
  registry.register(providers.activity)
  registry.register(providers.transfer)
  registry.register(providers.visa)
  const integrationWeather = lookupIntegrationWeatherProvider()
  registry.register(integrationWeather ?? providers.weather)
  registry.register(providers.destination)
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
