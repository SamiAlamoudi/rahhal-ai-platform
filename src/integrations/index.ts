export type { CurrencyRate, CurrencyInfo, CurrencyProvider } from './contracts'
export {
  getIntegrationConfig,
  clearConfigCache,
  type IntegrationConfig,
  type ProviderConfig,
  type ProviderAdapterType,
} from './config'
export {
  MockFlightAdapter,
  MockHotelAdapter,
  MockActivityAdapter,
  MockTransferAdapter,
  MockRentalCarAdapter,
  MockWeatherAdapter,
  RealWeatherAdapter,
  MockVisaAdapter,
  MockCurrencyAdapter,
} from './adapters'
export {
  AmadeusFlightAdapter,
  AmadeusOAuthClient,
  AmadeusFlightApiClient,
  normalizeAmadeusResponse,
  type AmadeusFlightAdapterConfig,
  type FlightSearchQuery,
  type AmadeusToken,
  type OAuthResult,
  type AmadeusFlightOffersResponse,
  type AmadeusFlightOffer,
  type AmadeusItinerary,
  type AmadeusSegment,
  type NormalizedFlightOffer,
  type FlightQualityScores,
} from './providers/amadeus'
export {
  BookingComAdapter,
  BookingComApiClient,
  normalizeBookingComResponse,
  normalizeToHotelModel,
  type BookingComAdapterConfig,
  type HotelSearchQuery,
  type BookingComSearchResponse,
  type BookingComHotelResult,
  type Hotel,
} from './providers/booking'
export {
  RentalCarsComAdapter,
  RentalCarsApiClient,
  normalizeRentalCarsResponse,
  normalizeRentalCar,
  mapCategory,
  mapTransmission,
  mapFuelType,
  type RentalCarsAdapterConfig,
  type RentalCarSearchQuery,
  type RentalCarsSearchResponse,
  type RentalCarsSearchResult,
} from './providers/rentalcars'
export {
  createFlightService,
  getFlightService,
  resetFlightService,
  type FlightService,
  type FlightModel,
} from './providers/flightService'
export {
  createHotelService,
  getHotelService,
  resetHotelService,
  type HotelService,
  type HotelModel,
} from './providers/hotelService'
export {
  createRentalCarService,
  getRentalCarService,
  resetRentalCarService,
  type RentalCarService,
  type RentalCarModel,
} from './providers/rentalCarService'
export {
  createProviderRegistry,
  getProviderRegistry,
  resetProviderRegistry,
  type ProviderRegistry,
  type ProviderRegistryEntry,
  type IntegrationProvider,
} from './registry'
export {
  createProviderHealthService,
  getProviderHealthService,
  resetHealthService,
  type ProviderHealth,
  type ProviderHealthService,
} from './health'
export {
  createWeatherService,
  getWeatherService,
  resetWeatherService,
  type WeatherService,
  type WeatherModel,
  normalizeOpenWeatherResponse,
  computeTravelScore,
  mapCondition,
  type WeatherTravelScore,
} from './weather'
export { OpenWeatherApiClient, type OpenWeatherResponse, type OpenWeatherForecastItem } from './api'
export {
  DEFERRED_CATALOG_DOMAINS,
  getCatalogStatus,
  isDeferredCatalogDomain,
  type CatalogAvailability,
  type CatalogDomain,
  type CatalogDomainStatus,
} from './catalogStatus'
