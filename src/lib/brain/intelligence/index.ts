/**
 * Sprint 53 — Real World Intelligence Layer public API.
 */

export type {
  LiveDomain,
  LiveEvent,
  LiveEventType,
  LiveIntelligenceSnapshot,
  FlightOffer,
  HotelOffer,
  WeatherSignal,
  VisaSignal,
  EventSignal,
  SafetySignal,
  ExchangeSignal,
  TransportSignal,
  PriceWatchSignal,
  LiveQuery,
  LiveProviderHealth,
  AvailabilityResult,
  PricingResult,
  BookingResult,
  CancelResult,
  StatusResult,
} from './types'

export {
  isRealWorldIntelligenceEnabled,
  REAL_WORLD_INTELLIGENCE_FEATURE_ID,
} from './feature'

export {
  gatherLiveIntelligence,
  resetLiveCache,
} from './orchestrator'
export type { GatherLiveIntelligenceInput } from './orchestrator'

export {
  createDefaultLiveProviders,
  providersForDomains,
} from './providers'
export type { LiveProvider, LiveProviderMetadata } from './providers'
export { createMockFlightProvider } from './providers/mocks/flightMock'
export { createMockHotelProvider } from './providers/mocks/hotelMock'
export {
  createMockWeatherProvider,
  createMockVisaProvider,
  createMockEventProvider,
  createMockSafetyProvider,
  createMockExchangeProvider,
  createMockTransportProvider,
  createMockPriceWatchProvider,
} from './providers/mocks'

export {
  onLiveEvent,
  emitLiveEvent,
  getLiveEventHistory,
  resetLiveEventBus,
} from './eventBus'

export {
  liveCacheGet,
  liveCacheSet,
  liveCacheInvalidate,
  liveCacheStats,
} from './cache'

export {
  callProviderResilient,
  withRetry,
  withTimeout,
  circuitAllow,
  circuitSnapshot,
  resetCircuits,
} from './resilience'

export {
  recordLiveSample,
  getLiveTelemetryDashboard,
  resetLiveTelemetry,
} from './observability'

export { selectLiveDomains } from './domainSelection'
