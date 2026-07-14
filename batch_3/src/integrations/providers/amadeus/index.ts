export { AmadeusOAuthClient, type AmadeusToken, type OAuthClientConfig, type OAuthResult } from './amadeusOAuthClient'
export {
  AmadeusFlightApiClient,
  type FlightSearchQuery,
  type ApiClientConfig as AmadeusApiClientConfig,
  type ApiClientResult as AmadeusApiClientResult,
  type AmadeusFlightOffersResponse,
  type AmadeusFlightOffer,
  type AmadeusItinerary,
  type AmadeusSegment,
  type AmadeusPrice,
  type AmadeusDictionaries,
  type AmadeusTravelerPricing,
  type AmadeusFareDetail,
} from './amadeusFlightApiClient'
export { AmadeusFlightAdapter, type AmadeusFlightAdapterConfig } from './amadeusFlightAdapter'
export {
  normalizeAmadeusResponse,
  normalizeAmadeusFlightOffer,
  mapCabin,
  parseDuration,
  computeFlightQuality,
  type NormalizedFlightOffer,
  type FlightQualityScores,
} from './flightNormalization'
