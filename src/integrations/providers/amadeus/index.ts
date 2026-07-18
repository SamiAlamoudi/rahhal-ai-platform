export { AmadeusOAuthClient, type AmadeusToken, type OAuthClientConfig, type OAuthResult } from './amadeusOAuthClient'
export { AMADEUS_DEFAULT_HOST, normalizeAmadeusHost, amadeusV1Url } from './amadeusHost'
export {
  AMADEUS_SANDBOX_HOST,
  AMADEUS_PRODUCTION_HOST,
  AMADEUS_FLIGHT_PROVIDER_ID,
  isAmadeusSandboxHost,
  buildAmadeusSandboxBookingUrl,
  describeAmadeusSandboxReadiness,
  type AmadeusSandboxReadiness,
} from './amadeusSandbox'
export {
  AmadeusFlightApiClient,
  type FlightSearchQuery,
  type ApiClientConfig as AmadeusApiClientConfig,
  type ApiClientResult as AmadeusApiClientResult,
  type AmadeusFlightOffersResponse,
  type AmadeusFlightOffersPricingResponse,
  type AmadeusFlightOffer,
  type AmadeusItinerary,
  type AmadeusSegment,
  type AmadeusPrice,
  type AmadeusDictionaries,
  type AmadeusTravelerPricing,
  type AmadeusFareDetail,
  type AmadeusLocationResult,
  type AmadeusLocationsResponse,
  type AmadeusAirlineResult,
  type AmadeusAirlinesResponse,
} from './amadeusFlightApiClient'
export {
  AmadeusFlightAdapter,
  type AmadeusFlightAdapterConfig,
  type AmadeusOfferDetailsResult,
} from './amadeusFlightAdapter'
export {
  buildAmadeusBookingReadyPayload,
  buildTravelerSlots,
  type AmadeusBookingReadyPayload,
  type BookingReadyTravelerSlot,
} from './bookingReadyPayload'
export {
  normalizeAmadeusResponse,
  normalizeAmadeusFlightOffer,
  mapCabin,
  parseDuration,
  computeFlightQuality,
  type NormalizedFlightOffer,
  type FlightQualityScores,
} from './flightNormalization'
export {
  resolveAirportCode,
  resolveAirportAlias,
  parseValidIata,
  normalizeAirportQuery,
  pickBestLocation,
  type ResolvedAirport,
  type AirportResolveResult,
} from './airportResolution'
export {
  buildAmadeusFlightSearchQuery,
  mapCabinForApi,
  type FlightSearchBuildResult,
} from './flightSearchModule'

// Sprint: Live Travel Search — named public modules
export { AmadeusClient, type AmadeusClientConfig } from './AmadeusClient'
export {
  AmadeusLiveFlightProvider,
  FlightProvider,
  createAmadeusFlightProvider,
  type AmadeusFlightProviderConfig,
  type FlightSearchPresentation,
} from './FlightProvider'
export { AirportResolver, type AirportResolverOptions } from './AirportResolver'
export {
  mapAmadeusOffers,
  enrichMappedOffer,
  sortAndSelectTopFlights,
  selectTopFlightOptions,
  formatFlightOfferForConversation,
  formatFlightOffersForConversation,
  TOP_FLIGHT_OPTIONS,
  type MappedFlightOffer,
  type FlightSortMode,
} from './FlightMapper'
export {
  FlightCache,
  FLIGHT_CACHE_TTL_MS,
  buildFlightCacheKey,
  getSharedFlightCache,
  resetSharedFlightCache,
  type FlightCacheEntry,
} from './FlightCache'
export { formatRankedFlightsForConversation } from './conversationFlightFormat'
