/**
 * Real Provider Adapter Architecture — public facade.
 *
 * The Travel Agent / chatEngine only talk to tools → AggregationEngine.
 * Concrete vendors (Amadeus, Booking, Rome2Rio, …) implement ProviderAdapter
 * and register here. Default runtime uses mock adapters; future live providers
 * plug into the same interface without refactoring the agent.
 */

export {
  createProviderAdapter,
  createProviderRegistry,
  createAggregationEngine,
  createDefaultAggregationEngine,
  createDefaultProviderRegistry,
  createActiveMockProviderRegistry,
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
  normalizeProviderError,
  createProviderHealthTracker,
  buildProviderCapabilities,
  FUTURE_PROVIDER_CATALOG,
  selectProviders,
  withRetry,
  DEFAULT_RETRY_POLICY,
} from '../aggregation'

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
  ProviderHealthSnapshot,
  ProviderHealthStatus,
  ProviderMetadata,
  ProviderRegistry,
  ProviderSelectionOptions,
  ProviderSelectionStrategy,
  RetryPolicy,
  RateLimitPolicy,
} from '../aggregation'
