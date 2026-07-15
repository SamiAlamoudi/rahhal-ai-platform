export type {
  AggregatableDomain,
  AggregationEngine,
  AggregationQuery,
  AggregationResult,
  KnownProviderId,
  NormalizedOffer,
  NormalizedProviderError,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderErrorCode,
  ProviderFetchResult,
  ProviderFetchStatus,
  ProviderHealthSnapshot,
  ProviderHealthStatus,
  ProviderMetadata,
  ProviderRegistry,
  ProviderSelectionOptions,
  ProviderSelectionStrategy,
  RateLimitPolicy,
  RetryPolicy,
} from './types'
export { createProviderRegistry } from './providerRegistry'
export { createAggregationEngine } from './engine'
export {
  createDefaultAggregationEngine,
  createDefaultProviderRegistry,
  createActiveMockProviderRegistry,
} from './factory'
export { createProviderAdapter } from './baseAdapter'
export { normalizeProviderError, statusFromErrorCode } from './errors'
export { createProviderHealthTracker, isProviderHealthyEnough } from './health'
export { buildProviderCapabilities, FUTURE_PROVIDER_CATALOG } from './capabilities'
export { selectProviders, selectNextFallback, domainsSupportedByRegistry } from './selection'
export { withRetry, DEFAULT_RETRY_POLICY } from './retry'
export { dedupeOffers } from './dedupe'
export { rankOffers } from './ranking'
export { scoreOfferConfidence, averageConfidence } from './confidence'
export { mergeCompatibleOffers } from './merge'
export { aggregationResultToToolData, topOfferSummary } from './toToolData'
export {
  createDefaultMockProviderAdapters,
  createActiveMockProviderAdapters,
  createFutureProviderStubs,
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
  createMockRome2RioAdapter,
  createUnavailableProviderStub,
  createDuplicateFlightAdapterForTests,
} from './mockProviders'
