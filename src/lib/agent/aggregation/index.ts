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
  createDefaultProviderAdapters,
  createLiveIntegration,
  createLiveIntegrationEngine,
  createLiveProviderRegistry,
  createLiveProviderAdapters,
} from './factory'
export {
  resolveProviderFeatureFlags,
  isLiveProviderFlagEnabled,
  liveFlagKeyForProviderId,
  mockFallbackIdForLiveProvider,
  createCircuitBreaker,
  createProviderMetrics,
  createProviderSelectionLog,
  createProviderRateLimiter,
  resolveLiveProviderEnvironment,
  wrapAdapterForLiveIntegration,
} from './liveIntegration'

/** Phase AJ — live provider enablement preparation */
export {
  getProviderConfigurationRegistry,
  getRegistryEntry,
  resolveProviderEnablementFlags,
  isCapabilityLiveEnabled,
  checkProviderReadiness,
  checkAllProviderReadiness,
  selectProviderForCapability,
  selectAllCapabilities,
  getProviderDiagnostics,
  runProvidersCheck,
  resolveEnablementAwareFeatureFlags,
  toPhaseWFeatureFlags,
  validateSecretPresence,
  maskSecretValue,
  runSandboxProbes,
  PROVIDER_FAILURE_POLICY,
  failurePolicyFor,
  syncProviderEnablementFeatureFlags,
  enforceSingleLiveCapability,
  PRIMARY_SANDBOX_PROVIDER_ID,
  PRIMARY_SANDBOX_CAPABILITY,
  createAmadeusSandboxProbeFn,
  isAmadeusSandboxValidationModeEnabled,
  runAmadeusSandboxValidation,
  runAmadeusSandboxValidationCli,
  validateAmadeusFlightOffersShape,
} from './providerEnablement'
export type {
  ProviderCapability,
  ProviderEnablementFlags,
  ProviderReadinessResult,
  ProviderSelectionDecision,
  ProviderRegistryEntry,
  ProviderDiagnosticsReport,
} from './providerEnablement'
export type {
  LiveProviderFlagKey,
  ProviderFeatureFlags,
  CircuitBreaker,
  CircuitBreakerSnapshot,
  CircuitState,
  ProviderMetrics,
  ProviderMetricCounters,
  ProviderSelectionLog,
  ProviderSelectionLogEntry,
  ProviderRateLimiter,
  LiveIntegrationContext,
  CreateLiveIntegrationOptions,
  LiveProviderEnvironment,
} from './liveIntegration'
export {
  createAmadeusProviderAdapter,
  resolveAmadeusProviderConfig,
  isAmadeusConfigured,
  resolveAmadeusEnvironment,
  SANDBOX_HOST,
  PRODUCTION_HOST,
  flightOffersToNormalizedOffers,
  createAmadeusAuthClient,
  AmadeusClientCredentialsAuth,
} from './providers/amadeus'
export type {
  AmadeusProviderConfig,
  AmadeusEnvironment,
  CreateAmadeusProviderAdapterOptions,
  AmadeusAuthClient,
} from './providers/amadeus'
export {
  createBookingComProviderAdapter,
  resolveBookingComProviderConfig,
  isBookingComConfigured,
  hotelOffersToNormalizedOffers,
} from './providers/booking'
export type {
  BookingComProviderConfig,
  CreateBookingComProviderAdapterOptions,
} from './providers/booking'
export {
  createGoogleMapsProviderAdapter,
  resolveGoogleMapsProviderConfig,
  isGoogleMapsConfigured,
  routeLegsToNormalizedOffers,
  locationToNormalizedOffer,
} from './providers/googleMaps'
export type {
  GoogleMapsProviderConfig,
  CreateGoogleMapsProviderAdapterOptions,
  GoogleMapsProviderAdapter,
} from './providers/googleMaps'
export {
  createOpenWeatherProviderAdapter,
  createWeatherProviderAdapter,
  resolveOpenWeatherProviderConfig,
  isOpenWeatherConfigured,
  weatherSnapshotToNormalizedOffer,
} from './providers/openWeather'
export type {
  OpenWeatherProviderConfig,
  CreateOpenWeatherProviderAdapterOptions,
  WeatherProviderAdapter,
} from './providers/openWeather'
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
