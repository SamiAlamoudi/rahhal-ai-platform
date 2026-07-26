/**
 * Sprint 57 — TravelDataService
 * Fetch → normalize (via providers) → cache → merge → score → prioritize.
 * No UI logic. No Conversation Brain coupling.
 */

import { TravelDataCache } from './cache'
import { mockProvenance } from './provenance'
import { ProviderRegistry } from './registry'
import {
  prioritizeActivities,
  prioritizeFlights,
  prioritizeHotels,
  prioritizeRestaurants,
  scoreTripOffer,
} from './score'
import type {
  Activity,
  CurrencyQuote,
  Flight,
  Hotel,
  MapRoute,
  Restaurant,
  TripOffer,
  VisaInfo,
  Weather,
} from './models'
import type {
  ActivitySearchQuery,
  CurrencyQuery,
  FlightSearchQuery,
  HotelSearchQuery,
  MapRouteQuery,
  RestaurantSearchQuery,
  VisaQuery,
  WeatherQuery,
} from './providers/types'

export interface TravelDataServiceOptions {
  registry?: ProviderRegistry
  cache?: TravelDataCache
  cacheTtlMs?: number
}

export interface DestinationBundleQuery {
  origin: string
  destination: string
  destinationCity: string
  departDate: string
  returnDate?: string | null
  checkIn: string
  checkOut: string
  adults?: number
  currency?: string
  nationality?: string
  destinationCountry?: string
}

export class TravelDataService {
  private readonly registry: ProviderRegistry
  private readonly cache: TravelDataCache
  private readonly cacheTtlMs: number

  constructor(options: TravelDataServiceOptions = {}) {
    this.registry = options.registry ?? ProviderRegistry.createWithMocks()
    this.cache = options.cache ?? new TravelDataCache(options.cacheTtlMs ?? 60_000)
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000
  }

  getRegistry(): ProviderRegistry {
    return this.registry
  }

  clearCache(): void {
    this.cache.clear()
  }

  async searchFlights(query: FlightSearchQuery): Promise<Flight[]> {
    const key = `flights:${JSON.stringify(query)}`
    const hit = this.cache.get<Flight[]>(key)
    if (hit) return hit
    const rows = await this.registry.getFlight().searchFlights(query)
    const ranked = prioritizeFlights(rows)
    this.cache.set(key, ranked, this.cacheTtlMs)
    return ranked
  }

  async searchHotels(query: HotelSearchQuery): Promise<Hotel[]> {
    const key = `hotels:${JSON.stringify(query)}`
    const hit = this.cache.get<Hotel[]>(key)
    if (hit) return hit
    const rows = await this.registry.getHotel().searchHotels(query)
    const ranked = prioritizeHotels(rows)
    this.cache.set(key, ranked, this.cacheTtlMs)
    return ranked
  }

  async searchActivities(query: ActivitySearchQuery): Promise<Activity[]> {
    const key = `activities:${JSON.stringify(query)}`
    const hit = this.cache.get<Activity[]>(key)
    if (hit) return hit
    const rows = await this.registry.getActivity().searchActivities(query)
    const ranked = prioritizeActivities(rows)
    this.cache.set(key, ranked, this.cacheTtlMs)
    return ranked
  }

  async searchRestaurants(query: RestaurantSearchQuery): Promise<Restaurant[]> {
    const key = `restaurants:${JSON.stringify(query)}`
    const hit = this.cache.get<Restaurant[]>(key)
    if (hit) return hit
    const rows = await this.registry.getRestaurant().searchRestaurants(query)
    const ranked = prioritizeRestaurants(rows)
    this.cache.set(key, ranked, this.cacheTtlMs)
    return ranked
  }

  async getWeather(query: WeatherQuery): Promise<Weather[]> {
    const key = `weather:${JSON.stringify(query)}`
    const hit = this.cache.get<Weather[]>(key)
    if (hit) return hit
    const rows = await this.registry.getWeather().getWeather(query)
    this.cache.set(key, rows, this.cacheTtlMs)
    return rows
  }

  async getRoute(query: MapRouteQuery): Promise<MapRoute[]> {
    const key = `maps:${JSON.stringify(query)}`
    const hit = this.cache.get<MapRoute[]>(key)
    if (hit) return hit
    const rows = await this.registry.getMap().getRoute(query)
    this.cache.set(key, rows, this.cacheTtlMs)
    return rows
  }

  async getCurrency(query: CurrencyQuery): Promise<CurrencyQuote> {
    const key = `currency:${JSON.stringify(query)}`
    const hit = this.cache.get<CurrencyQuote>(key)
    if (hit) return hit
    const row = await this.registry.getCurrency().getRate(query)
    this.cache.set(key, row, this.cacheTtlMs)
    return row
  }

  async getVisa(query: VisaQuery): Promise<VisaInfo> {
    const key = `visa:${JSON.stringify(query)}`
    const hit = this.cache.get<VisaInfo>(key)
    if (hit) return hit
    const row = await this.registry.getVisa().getVisaInfo(query)
    this.cache.set(key, row, this.cacheTtlMs)
    return row
  }

  /**
   * Merge multi-domain mock results into a scored TripOffer.
   * Ready for future multi-provider merge without Conversation Brain changes.
   */
  async buildDestinationBundle(query: DestinationBundleQuery): Promise<TripOffer> {
    const currency = query.currency || 'SAR'
    const [
      flights,
      hotels,
      activities,
      restaurants,
      weather,
    ] = await Promise.all([
      this.searchFlights({
        origin: query.origin,
        destination: query.destination,
        departDate: query.departDate,
        returnDate: query.returnDate,
        adults: query.adults,
        currency,
      }),
      this.searchHotels({
        city: query.destinationCity,
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        adults: query.adults,
        currency,
      }),
      this.searchActivities({
        city: query.destinationCity,
        currency,
      }),
      this.searchRestaurants({
        city: query.destinationCity,
      }),
      this.getWeather({
        location: query.destinationCity,
        date: query.checkIn,
      }),
    ])

    const topFlights = flights.slice(0, 2)
    const topHotels = hotels.slice(0, 2)
    const offer: TripOffer = {
      id: `offer-${query.destinationCity}-${query.departDate}`,
      label: `${query.destinationCity} starter bundle`,
      destination: query.destinationCity,
      flights: topFlights,
      hotels: topHotels,
      activities: activities.slice(0, 2),
      restaurants: restaurants.slice(0, 2),
      weather,
      score: 0,
      provenance: mockProvenance('travel_data_service', 0.7, true),
    }
    offer.score = scoreTripOffer(offer)
    return offer
  }
}

export function createTravelDataService(
  options?: TravelDataServiceOptions,
): TravelDataService {
  return new TravelDataService(options)
}
