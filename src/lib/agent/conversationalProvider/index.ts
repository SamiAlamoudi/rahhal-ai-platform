/**
 * Sprint 80 P1-3 — Unified conversational travel search provider layer.
 * Sprint 80 P1-4 — Live flight provider pilot (Amadeus) behind
 * `ai.live_flight_provider_pilot` (default OFF).
 *
 * Components:
 * - Provider Interface (`types.ts`)
 * - Provider Registry (`registry.ts`)
 * - Provider Resolver (`resolver.ts`)
 * - Request Mapper (`requestMapper.ts`)
 * - Response Normalizer (`responseNormalizer.ts`)
 * - Error Handling (`errors.ts`)
 * - Flight pilot + telemetry (`flightPilot.ts`, `telemetry.ts`)
 *
 * Feature flags default OFF — legacy bridges unchanged.
 */

export {
  CONVERSATIONAL_PROVIDER_UNIFY_VERSION,
  type ConversationalProviderCapabilities,
  type ConversationalProviderDomain,
  type ConversationalProviderErrorCode,
  type ConversationalProviderId,
  type ConversationalProviderMode,
  type ConversationalToolSearchResult,
  type ConversationalTravelProvider,
  type UnifiedProviderOffer,
  type UnifiedProviderRequest,
  type UnifiedProviderSearchResult,
} from './types'

export {
  ConversationalProviderError,
  GRACEFUL_CONVERSATIONAL_PROVIDER_MESSAGE,
  classifyConversationalProviderFailure,
  isRetryableConversationalProviderCode,
  mapLiveFlightErrorCode,
} from './errors'

export {
  LIVE_FLIGHT_PROVIDER_PILOT_FEATURE_ID,
  isLiveFlightProviderPilotEnabled,
} from './pilotFeature'

export {
  LIVE_FLIGHT_PROVIDER_PILOT_VERSION,
  runLiveFlightProviderPilot,
  shouldUseLiveFlightProviderPilot,
  type LiveFlightProviderPilotDeps,
} from './flightPilot'

export {
  FlightPilotTelemetry,
  createFlightPilotTelemetry,
  getFlightPilotTelemetry,
  resetFlightPilotTelemetry,
  type FlightPilotTelemetryEvent,
  type FlightPilotTelemetrySnapshot,
} from './telemetry'

export {
  AMADEUS_LIVE_FLIGHT_PROVIDER_ID,
  createAmadeusLiveFlightProvider,
  createLiveFlightProvider,
} from './adapters/amadeusLiveFlightProvider'

export {
  ConversationalProviderRegistry,
  createConversationalProviderRegistry,
  getConversationalProviderRegistry,
  resetConversationalProviderRegistry,
} from './registry'

export {
  filterAvailableProviders,
  resolveConversationalProviders,
  type ResolveProviderOptions,
  type ResolvedProviders,
} from './resolver'

export {
  conversationalRequestFingerprint,
  mapConversationalProviderRequest,
  type MapRequestOptions,
} from './requestMapper'

export {
  normalizeToUnifiedSearchResult,
  normalizeToolSearchResultToOffers,
  unifiedResultToToolSearchResult,
} from './responseNormalizer'

export {
  CONVERSATIONAL_PROVIDER_UNIFY_FEATURE_ID,
  isConversationalProviderUnifyEnabled,
} from './feature'

export {
  buildDefaultConversationalProviderRegistry,
  runConversationalProviderSearch,
  runConversationalProviderToolSearch,
  type RunConversationalProviderSearchOptions,
} from './search'

export {
  runUnifiedConversationFlightSearch,
  runUnifiedConversationHotelSearch,
  shouldUseConversationalProviderUnify,
  type UnifiedFlightBridgeDeps,
  type UnifiedHotelBridgeDeps,
} from './bridge'

export { createMockFlightConversationalProvider } from './adapters/mockFlightProvider'
export { createMockHotelConversationalProvider } from './adapters/mockHotelProvider'
export { createLiveFlightConversationalProvider } from './adapters/liveFlightProvider'
export { createLiveHotelConversationalProvider } from './adapters/liveHotelProvider'
