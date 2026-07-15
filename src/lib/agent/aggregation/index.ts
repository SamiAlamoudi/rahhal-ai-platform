export type {
  AggregatableDomain,
  AggregationEngine,
  AggregationQuery,
  AggregationResult,
  KnownProviderId,
  NormalizedOffer,
  ProviderAdapter,
  ProviderFetchResult,
  ProviderMetadata,
  ProviderRegistry,
} from './types'
export { createProviderRegistry } from './providerRegistry'
export { createAggregationEngine } from './engine'
export { createDefaultAggregationEngine, createDefaultProviderRegistry } from './factory'
export { dedupeOffers } from './dedupe'
export { rankOffers } from './ranking'
export { scoreOfferConfidence, averageConfidence } from './confidence'
export { mergeCompatibleOffers } from './merge'
export { aggregationResultToToolData, topOfferSummary } from './toToolData'
export {
  createDefaultMockProviderAdapters,
  createMockAmadeusAdapter,
  createMockDuffelAdapter,
  createMockBookingComAdapter,
  createMockExpediaAdapter,
  createMockOpenWeatherAdapter,
  createMockGoogleMapsAdapter,
  createMockOpenStreetMapAdapter,
  createMockExchangeRateAdapter,
  createMockVisaInfoAdapter,
  createMockAttractionsCatalogAdapter,
  createUnavailableProviderStub,
  createDuplicateFlightAdapterForTests,
} from './mockProviders'
