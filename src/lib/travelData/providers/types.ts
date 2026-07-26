/**
 * Sprint 57 — Provider-agnostic interfaces.
 * Future Amadeus / Booking / Google / OpenWeather plug in here.
 */

import type {
  Activity,
  CurrencyQuote,
  Flight,
  Hotel,
  MapRoute,
  Restaurant,
  VisaInfo,
  Weather,
} from '../models'

export type TravelProviderId = string

export interface FlightSearchQuery {
  origin: string
  destination: string
  departDate: string
  returnDate?: string | null
  adults?: number
  cabin?: Flight['cabin']
  currency?: string
}

export interface HotelSearchQuery {
  city: string
  checkIn: string
  checkOut: string
  adults?: number
  currency?: string
}

export interface ActivitySearchQuery {
  city: string
  date?: string | null
  category?: string | null
  currency?: string
}

export interface RestaurantSearchQuery {
  city: string
  cuisine?: string | null
}

export interface WeatherQuery {
  location: string
  date?: string | null
}

export interface MapRouteQuery {
  from: string
  to: string
  mode?: MapRoute['mode']
}

export interface CurrencyQuery {
  base: string
  quote: string
  amount?: number
}

export interface VisaQuery {
  nationality: string
  destinationCountry: string
}

export interface FlightProvider {
  readonly id: TravelProviderId
  searchFlights(query: FlightSearchQuery): Promise<Flight[]>
}

export interface HotelProvider {
  readonly id: TravelProviderId
  searchHotels(query: HotelSearchQuery): Promise<Hotel[]>
}

export interface ActivityProvider {
  readonly id: TravelProviderId
  searchActivities(query: ActivitySearchQuery): Promise<Activity[]>
}

export interface RestaurantProvider {
  readonly id: TravelProviderId
  searchRestaurants(query: RestaurantSearchQuery): Promise<Restaurant[]>
}

export interface WeatherProvider {
  readonly id: TravelProviderId
  getWeather(query: WeatherQuery): Promise<Weather[]>
}

export interface MapProvider {
  readonly id: TravelProviderId
  getRoute(query: MapRouteQuery): Promise<MapRoute[]>
}

export interface CurrencyProvider {
  readonly id: TravelProviderId
  getRate(query: CurrencyQuery): Promise<CurrencyQuote>
}

export interface VisaProvider {
  readonly id: TravelProviderId
  getVisaInfo(query: VisaQuery): Promise<VisaInfo>
}

export interface TravelProviderBundle {
  flights?: FlightProvider
  hotels?: HotelProvider
  activities?: ActivityProvider
  restaurants?: RestaurantProvider
  weather?: WeatherProvider
  maps?: MapProvider
  currency?: CurrencyProvider
  visa?: VisaProvider
}
