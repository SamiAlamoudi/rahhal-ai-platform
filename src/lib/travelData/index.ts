/**
 * Sprint 57 — Real Travel Data Foundation
 *
 * Provider-agnostic travel intelligence layer.
 * Conversation Brain / Concierge remain unchanged; they may consume this
 * service later through the registry without vendor coupling.
 */

export type {
  Activity,
  CurrencyQuote,
  DataProvenance,
  Flight,
  Hotel,
  Location,
  MapRoute,
  Price,
  Restaurant,
  TravelDomain,
  TripOffer,
  VisaInfo,
  Weather,
} from './models'

export type {
  ActivityProvider,
  ActivitySearchQuery,
  CurrencyProvider,
  CurrencyQuery,
  FlightProvider,
  FlightSearchQuery,
  HotelProvider,
  HotelSearchQuery,
  MapProvider,
  MapRouteQuery,
  RestaurantProvider,
  RestaurantSearchQuery,
  TravelProviderBundle,
  TravelProviderId,
  VisaProvider,
  VisaQuery,
  WeatherProvider,
  WeatherQuery,
} from './providers/types'

export {
  createMockActivityProvider,
  createMockCurrencyProvider,
  createMockFlightProvider,
  createMockHotelProvider,
  createMockMapProvider,
  createMockRestaurantProvider,
  createMockTravelProviders,
  createMockVisaProvider,
  createMockWeatherProvider,
} from './providers/mockProviders'

export { ProviderRegistry, type ProviderRegistrySnapshot } from './registry'
export { TravelDataCache } from './cache'
export {
  TravelDataService,
  createTravelDataService,
  type DestinationBundleQuery,
  type TravelDataServiceOptions,
} from './service'
export {
  prioritizeActivities,
  prioritizeFlights,
  prioritizeHotels,
  prioritizeRestaurants,
  scoreActivity,
  scoreFlight,
  scoreHotel,
  scoreRestaurant,
  scoreTripOffer,
} from './score'
export { mockProvenance, clamp01 } from './provenance'
