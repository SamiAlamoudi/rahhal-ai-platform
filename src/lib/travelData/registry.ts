/**
 * Sprint 57 — ProviderRegistry.
 * Conversation layers request travel data through this registry only (never vendor SDKs).
 */

import type { TravelDomain } from './models'
import type {
  ActivityProvider,
  CurrencyProvider,
  FlightProvider,
  HotelProvider,
  MapProvider,
  RestaurantProvider,
  TravelProviderBundle,
  TravelProviderId,
  VisaProvider,
  WeatherProvider,
} from './providers/types'
import { createMockTravelProviders } from './providers/mockProviders'

export interface ProviderRegistrySnapshot {
  flights: TravelProviderId[]
  hotels: TravelProviderId[]
  activities: TravelProviderId[]
  restaurants: TravelProviderId[]
  weather: TravelProviderId[]
  maps: TravelProviderId[]
  currency: TravelProviderId[]
  visa: TravelProviderId[]
}

export class ProviderRegistry {
  private flights = new Map<TravelProviderId, FlightProvider>()
  private hotels = new Map<TravelProviderId, HotelProvider>()
  private activities = new Map<TravelProviderId, ActivityProvider>()
  private restaurants = new Map<TravelProviderId, RestaurantProvider>()
  private weather = new Map<TravelProviderId, WeatherProvider>()
  private maps = new Map<TravelProviderId, MapProvider>()
  private currency = new Map<TravelProviderId, CurrencyProvider>()
  private visa = new Map<TravelProviderId, VisaProvider>()

  /** Preferred provider id per domain (first registered wins unless set). */
  private preferred: Partial<Record<TravelDomain, TravelProviderId>> = {}

  static createWithMocks(): ProviderRegistry {
    const registry = new ProviderRegistry()
    registry.registerBundle(createMockTravelProviders())
    return registry
  }

  registerBundle(bundle: TravelProviderBundle): void {
    if (bundle.flights) this.registerFlight(bundle.flights)
    if (bundle.hotels) this.registerHotel(bundle.hotels)
    if (bundle.activities) this.registerActivity(bundle.activities)
    if (bundle.restaurants) this.registerRestaurant(bundle.restaurants)
    if (bundle.weather) this.registerWeather(bundle.weather)
    if (bundle.maps) this.registerMap(bundle.maps)
    if (bundle.currency) this.registerCurrency(bundle.currency)
    if (bundle.visa) this.registerVisa(bundle.visa)
  }

  registerFlight(provider: FlightProvider): void {
    this.flights.set(provider.id, provider)
    this.preferred.flights ??= provider.id
  }

  registerHotel(provider: HotelProvider): void {
    this.hotels.set(provider.id, provider)
    this.preferred.hotels ??= provider.id
  }

  registerActivity(provider: ActivityProvider): void {
    this.activities.set(provider.id, provider)
    this.preferred.activities ??= provider.id
  }

  registerRestaurant(provider: RestaurantProvider): void {
    this.restaurants.set(provider.id, provider)
    this.preferred.restaurants ??= provider.id
  }

  registerWeather(provider: WeatherProvider): void {
    this.weather.set(provider.id, provider)
    this.preferred.weather ??= provider.id
  }

  registerMap(provider: MapProvider): void {
    this.maps.set(provider.id, provider)
    this.preferred.maps ??= provider.id
  }

  registerCurrency(provider: CurrencyProvider): void {
    this.currency.set(provider.id, provider)
    this.preferred.currency ??= provider.id
  }

  registerVisa(provider: VisaProvider): void {
    this.visa.set(provider.id, provider)
    this.preferred.visa ??= provider.id
  }

  setPreferred(domain: TravelDomain, providerId: TravelProviderId): void {
    this.preferred[domain] = providerId
  }

  getFlight(providerId?: TravelProviderId): FlightProvider {
    return this.require('flights', this.flights, providerId)
  }

  getHotel(providerId?: TravelProviderId): HotelProvider {
    return this.require('hotels', this.hotels, providerId)
  }

  getActivity(providerId?: TravelProviderId): ActivityProvider {
    return this.require('activities', this.activities, providerId)
  }

  getRestaurant(providerId?: TravelProviderId): RestaurantProvider {
    return this.require('restaurants', this.restaurants, providerId)
  }

  getWeather(providerId?: TravelProviderId): WeatherProvider {
    return this.require('weather', this.weather, providerId)
  }

  getMap(providerId?: TravelProviderId): MapProvider {
    return this.require('maps', this.maps, providerId)
  }

  getCurrency(providerId?: TravelProviderId): CurrencyProvider {
    return this.require('currency', this.currency, providerId)
  }

  getVisa(providerId?: TravelProviderId): VisaProvider {
    return this.require('visa', this.visa, providerId)
  }

  snapshot(): ProviderRegistrySnapshot {
    return {
      flights: [...this.flights.keys()],
      hotels: [...this.hotels.keys()],
      activities: [...this.activities.keys()],
      restaurants: [...this.restaurants.keys()],
      weather: [...this.weather.keys()],
      maps: [...this.maps.keys()],
      currency: [...this.currency.keys()],
      visa: [...this.visa.keys()],
    }
  }

  private require<T extends { id: string }>(
    domain: TravelDomain,
    map: Map<string, T>,
    providerId?: string,
  ): T {
    const id = providerId || this.preferred[domain]
    if (id && map.has(id)) return map.get(id)!
    const first = map.values().next().value
    if (!first) {
      throw new Error(`ProviderRegistry: no provider registered for ${domain}`)
    }
    return first
  }
}
