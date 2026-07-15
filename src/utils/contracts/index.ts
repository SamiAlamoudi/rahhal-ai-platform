export type {
  ProviderResult,
  ProviderError,
  ProviderWarning,
  ErrorCategory,
  ErrorSeverity,
} from './result'
export { okResult, errorResult, fromThrown } from './result'

export type { ProviderCapabilities } from './capabilities'
export { defaultCapabilities } from './capabilities'

export type { ProviderMetadata, ProviderDomain } from './metadata'

export type {
  FlightSegment,
  FlightItinerary,
  FlightOffer,
  CabinClass,
  RoomType,
  HotelOffer,
  ActivityOffer,
  ActivityType,
  TransferOffer,
  TransferType,
  Vehicle,
  VehicleCategory,
  TransmissionType,
  FuelType,
  VisaInfo,
  WeatherInfo,
  WeatherForecast,
  WeatherCondition,
  DestinationInsight,
  PointOfInterest,
  POICategory,
  SafetyLevel,
} from './models'

export type {
  ProviderContract,
  ProviderRequest,
  FlightProvider,
  HotelProvider,
  ActivityProvider,
  TransferProvider,
  RentalCarProvider,
  VisaProvider,
  WeatherProvider,
  DestinationProvider,
} from './providers'

export {
  flightOfferToSearchResult,
  hotelOfferToSearchResult,
  activityOfferToSearchResult,
  transferOfferToSearchResult,
  flightContractToAdapter,
  hotelContractToAdapter,
  activityContractToAdapter,
  transferContractToAdapter,
  contractToAdapterAsync,
} from './bridge'

export {
  createContractRegistry,
  createDefaultContractRegistry,
  hydrateContractRegistry,
  type ContractRegistry,
  type DefaultContractRegistry,
  type AnyProvider,
} from './registry'

export {
  createMockContractProviders,
  type MockContractProviders,
  type FlightProviderWithSamples,
  type HotelProviderWithSamples,
  type ActivityProviderWithSamples,
  type TransferProviderWithSamples,
} from './mocks'
export { MockFlightProvider } from './mocks/mockFlightProvider'
export { MockHotelProvider } from './mocks/mockHotelProvider'
export { MockActivityProvider } from './mocks/mockActivityProvider'
export { MockTransferProvider } from './mocks/mockTransferProvider'
export { MockVisaProvider } from './mocks/mockVisaProvider'
export { MockWeatherProvider } from './mocks/mockWeatherProvider'
export { MockDestinationProvider } from './mocks/mockDestinationProvider'

