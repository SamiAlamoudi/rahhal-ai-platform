import type { FlightProvider } from '../../utils/contracts/providers/FlightProvider'
import type { HotelProvider } from '../../utils/contracts/providers/HotelProvider'
import type { ActivityProvider } from '../../utils/contracts/providers/ActivityProvider'
import type { TransferProvider } from '../../utils/contracts/providers/TransferProvider'
import type { RentalCarProvider } from '../../utils/contracts/providers/RentalCarProvider'
import type { VisaProvider } from '../../utils/contracts/providers/VisaProvider'
import type { WeatherProvider } from '../../utils/contracts/providers/WeatherProvider'
import type { ProviderDomain, ProviderMetadata } from '../../utils/contracts/metadata'
import type { CurrencyProvider } from '../contracts'
import { getIntegrationConfig, type ProviderAdapterType, type IntegrationConfig } from '../config'
import {
  MockFlightAdapter,
  MockHotelAdapter,
  MockActivityAdapter,
  MockTransferAdapter,
  MockRentalCarAdapter,
  MockWeatherAdapter,
  MockVisaAdapter,
  MockCurrencyAdapter,
  RealWeatherAdapter,
} from '../adapters'
import { AmadeusFlightAdapter } from '../providers/amadeus'
import { BookingComAdapter } from '../providers/booking'
import { RentalCarsComAdapter } from '../providers/rentalcars'

export type IntegrationProvider =
  | FlightProvider
  | HotelProvider
  | ActivityProvider
  | TransferProvider
  | RentalCarProvider
  | VisaProvider
  | WeatherProvider
  | CurrencyProvider

export interface ProviderRegistryEntry {
  domain: ProviderDomain | 'currency'
  adapterType: ProviderAdapterType
  provider: IntegrationProvider
}

export interface ProviderRegistry {
  getFlight(): FlightProvider | null
  getHotel(): HotelProvider | null
  getActivity(): ActivityProvider | null
  getTransfer(): TransferProvider | null
  getRentalCar(): RentalCarProvider | null
  getWeather(): WeatherProvider | null
  getVisa(): VisaProvider | null
  getCurrency(): CurrencyProvider | null
  getProvider(domain: ProviderDomain | 'currency'): IntegrationProvider | null
  listAll(): ProviderRegistryEntry[]
  listEnabled(): ProviderRegistryEntry[]
  isEnabled(domain: ProviderDomain | 'currency'): boolean
  getMetadata(domain: ProviderDomain | 'currency'): ProviderMetadata | null
}

function createAdapter(domain: ProviderDomain | 'currency', adapterType: ProviderAdapterType, config: IntegrationConfig): IntegrationProvider | null {
  switch (domain) {
    case 'flight':
      if (adapterType === 'mock') return new MockFlightAdapter()
      if (adapterType === 'amadeus') {
        const cfg = config.flight
        if (!cfg.clientId || !cfg.clientSecret) return null
        return new AmadeusFlightAdapter({
          clientId: cfg.clientId,
          clientSecret: cfg.clientSecret,
          baseUrl: cfg.baseUrl || 'https://test.api.amadeus.com',
          timeout: cfg.timeout,
          maxRetries: cfg.maxRetries,
        })
      }
      return null
    case 'hotel':
      if (adapterType === 'mock') return new MockHotelAdapter()
      if (adapterType === 'booking') {
        const cfg = config.hotel
        if (!cfg.apiKey) return null
        const rapidApiHost = cfg.host || 'booking-com15.p.rapidapi.com'
        return new BookingComAdapter({
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl || `https://${rapidApiHost}/api/v1`,
          rapidApiHost,
          timeout: cfg.timeout,
          maxRetries: cfg.maxRetries,
        })
      }
      return null
    case 'activity':
      if (adapterType === 'mock') return new MockActivityAdapter()
      return null
    case 'transfer':
      if (adapterType === 'mock') return new MockTransferAdapter()
      return null
    case 'rental-car':
      if (adapterType === 'mock') return new MockRentalCarAdapter()
      if (adapterType === 'rentalcars') {
        const cfg = config.rentalCar
        if (!cfg.apiKey) return null
        return new RentalCarsComAdapter({
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl || 'https://rentalcars-com.p.rapidapi.com/api/v1',
          timeout: cfg.timeout,
          maxRetries: cfg.maxRetries,
        })
      }
      return null
    case 'weather':
      if (adapterType === 'mock') return new MockWeatherAdapter()
      if (adapterType === 'openweather') {
        const cfg = config.weather
        if (!cfg.apiKey) return null
        return new RealWeatherAdapter({
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl || 'https://api.openweathermap.org/data/2.5',
          timeout: cfg.timeout,
          maxRetries: cfg.maxRetries,
        })
      }
      return null
    case 'visa':
      if (adapterType === 'mock') return new MockVisaAdapter()
      return null
    case 'currency':
      if (adapterType === 'mock') return new MockCurrencyAdapter()
      return null
    default:
      return null
  }
}

export function createProviderRegistry(): ProviderRegistry {
  const config = getIntegrationConfig()

  const entries = new Map<ProviderDomain | 'currency', ProviderRegistryEntry>()

  const domains: (ProviderDomain | 'currency')[] = ['flight', 'hotel', 'activity', 'transfer', 'rental-car', 'weather', 'visa', 'currency']

  const domainToConfigKey: Record<string, keyof typeof config> = {
    'flight': 'flight',
    'hotel': 'hotel',
    'activity': 'activity',
    'transfer': 'transfer',
    'rental-car': 'rentalCar',
    'weather': 'weather',
    'visa': 'visa',
    'currency': 'currency',
  }

  for (const domain of domains) {
    const cfg = config[domainToConfigKey[domain] ?? domain as keyof typeof config]
    if (!cfg || !cfg.enabled) continue
    const provider = createAdapter(domain, cfg.adapter, config)
    if (!provider) continue
    entries.set(domain, {
      domain,
      adapterType: cfg.adapter,
      provider,
    })
  }

  return {
    getFlight() {
      return entries.get('flight')?.provider as FlightProvider ?? null
    },
    getHotel() {
      return entries.get('hotel')?.provider as HotelProvider ?? null
    },
    getActivity() {
      return entries.get('activity')?.provider as ActivityProvider ?? null
    },
    getTransfer() {
      return entries.get('transfer')?.provider as TransferProvider ?? null
    },
    getRentalCar() {
      return entries.get('rental-car')?.provider as RentalCarProvider ?? null
    },
    getWeather() {
      return entries.get('weather')?.provider as WeatherProvider ?? null
    },
    getVisa() {
      return entries.get('visa')?.provider as VisaProvider ?? null
    },
    getCurrency() {
      return entries.get('currency')?.provider as CurrencyProvider ?? null
    },
    getProvider(domain) {
      return entries.get(domain)?.provider ?? null
    },
    listAll() {
      return Array.from(entries.values())
    },
    listEnabled() {
      return Array.from(entries.values())
    },
    isEnabled(domain) {
      return entries.has(domain)
    },
    getMetadata(domain) {
      return entries.get(domain)?.provider.metadata ?? null
    },
  }
}

let cachedRegistry: ProviderRegistry | null = null

export function getProviderRegistry(): ProviderRegistry {
  if (cachedRegistry) return cachedRegistry
  cachedRegistry = createProviderRegistry()
  return cachedRegistry
}

export function resetProviderRegistry(): void {
  cachedRegistry = null
}
