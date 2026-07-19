/**
 * Sprint 30 — Hotel Provider Foundation public API.
 */

export type {
  HotelProviderId,
  HotelProviderMode,
  HotelHealthStatus,
  HotelProviderErrorCode,
  HotelGuestReviews,
  HotelTaxesAndFees,
  HotelCancellationPolicy,
  HotelRoomAvailability,
  HotelImage,
  NormalizedHotelResult,
  HotelSearchRequest,
  HotelRoomAvailabilityRequest,
  HotelPricingRequest,
  HotelProviderError,
  HotelProviderResult,
  HotelProviderCapabilities,
  HotelProviderMetadata,
  HotelHealthSnapshot,
  HotelProviderMetricsSnapshot,
  HotelSearchOptions,
  HotelUnifiedSearchResult,
} from './types'

export type { HotelProvider } from './HotelProvider'

export {
  HotelSearchCache,
  HOTEL_CACHE_TTL_MS,
  buildHotelCacheKey,
  getSharedHotelSearchCache,
  resetSharedHotelSearchCache,
} from './HotelSearchCache'

export {
  HotelSearchNormalizer,
  hotelSearchNormalizer,
  type RawHotelVendorPayload,
  type RawHotelRoomPayload,
  type RawCancellationPayload,
  type HotelNormalizeContext,
} from './HotelSearchNormalizer'

export {
  HotelHealthMonitor,
  getHotelHealthMonitor,
  resetHotelHealthMonitor,
} from './HotelHealthMonitor'

export {
  HotelProviderMetrics,
  getHotelProviderMetrics,
  resetHotelProviderMetrics,
} from './HotelProviderMetrics'

export {
  HotelRateLimiter,
  DEFAULT_HOTEL_RATE_LIMIT,
  getHotelRateLimiter,
  resetHotelRateLimiter,
  type HotelRateLimitConfig,
  type HotelRateLimitDecision,
} from './rateLimit'

export {
  DEFAULT_HOTEL_RETRY_POLICY,
  hotelRetryDelayMs,
  withHotelRetry,
  type HotelRetryPolicy,
} from './retry'

export {
  HotelProviderRegistry,
  createHotelProviderRegistry,
  createDefaultHotelProviders,
  getHotelProviderRegistry,
  resetHotelProviderRegistry,
  type HotelProviderRegistryOptions,
} from './HotelProviderRegistry'

export { createSandboxHotelProvider } from './createSandboxHotelProvider'
export {
  buildSandboxHotels,
  defaultStayDates,
  isHotelSandboxOnly,
  HOTEL_SANDBOX_MODE,
} from './sandbox'

export {
  createHotelbedsAdapter,
  HOTELBEDS_PROVIDER_ID,
  createExpediaRapidAdapter,
  EXPEDIA_RAPID_PROVIDER_ID,
  createBookingConnectivityAdapter,
  BOOKING_CONNECTIVITY_PROVIDER_ID,
  createMockHotelsAdapter,
  MOCK_HOTELS_PROVIDER_ID,
} from './adapters'

export {
  toContractHotelOffer,
  toContractHotelOffers,
  toAggregationHotelOffers,
  toHotelSearchPayload,
  createHotelbedsAggregationAdapter,
  createExpediaRapidAggregationAdapter,
  createBookingConnectivityAggregationAdapter,
  createMockHotelsAggregationAdapter,
  createHotelFoundationAggregationAdapters,
  createFoundationHotelExecutionProvider,
  hotelSearchRequestFromMemory,
  searchHotelsForOrchestrator,
  applyHotelMemoryPreferenceBoost,
  type CreateFoundationHotelExecutionProviderOptions,
  type HotelMemoryHints,
} from './bridge'

export {
  isHotelProviderFoundationEnabled,
  HOTEL_PROVIDER_FOUNDATION_FEATURE_ID,
} from './feature'

import { resetHotelProviderRegistry as resetRegistrySingleton } from './HotelProviderRegistry'
import { resetSharedHotelSearchCache as resetCacheSingleton } from './HotelSearchCache'
import { resetHotelHealthMonitor as resetHealthSingleton } from './HotelHealthMonitor'
import { resetHotelProviderMetrics as resetMetricsSingleton } from './HotelProviderMetrics'
import { resetHotelRateLimiter as resetLimiterSingleton } from './rateLimit'

/** Reset shared hotel foundation singletons (tests). */
export function resetHotelProviderFoundation(): void {
  resetRegistrySingleton()
  resetCacheSingleton()
  resetHealthSingleton()
  resetMetricsSingleton()
  resetLimiterSingleton()
}
