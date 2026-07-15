/**
 * Unified Provider Adapter Architecture.
 * Vendor adapters plug in here — TravelAgent / tools never depend on Amadeus, Duffel, etc. directly.
 */

export type AggregatableDomain =
  | 'flights'
  | 'hotels'
  | 'weather'
  | 'maps'
  | 'currency'
  | 'visa'
  | 'attractions'
  | 'transportation'

/** Providers the architecture knows about (active mocks + future slots). */
export type KnownProviderId =
  // Flights
  | 'amadeus'
  | 'amadeus_mock'
  | 'duffel'
  | 'skyscanner'
  // Hotels
  | 'booking_com'
  | 'booking_com_mock'
  | 'expedia'
  | 'hotelbeds'
  // Maps
  | 'google_maps'
  | 'google_maps_mock'
  | 'mapbox'
  | 'openstreetmap'
  // Weather
  | 'openweather'
  | 'tomorrow_io'
  // Currency
  | 'exchangerate'
  // Visa
  | 'visa_info'
  | 'sherpa'
  // Attractions
  | 'attractions_catalog'
  | 'google_places'
  | 'viator'
  | 'getyourguide'
  // Transportation
  | 'rome2rio'

export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export type ProviderErrorCode =
  | 'timeout'
  | 'rate_limited'
  | 'unavailable'
  | 'unsupported_domain'
  | 'invalid_input'
  | 'upstream_error'
  | 'aborted'
  | 'not_configured'
  | 'unknown'

export type ProviderFetchStatus =
  | 'ok'
  | 'error'
  | 'timeout'
  | 'skipped'
  | 'rate_limited'

export type ProviderSelectionStrategy =
  /** Query all healthy providers for the domain in parallel (default). */
  | 'parallel'
  /** Try highest-priority provider first; fall back automatically on failure/empty. */
  | 'priority_fallback'

export interface ProviderCapabilities {
  providerId: string
  domains: AggregatableDomain[]
  /** Human-readable feature flags the adapter claims. */
  features: string[]
  supportsSearch: boolean
  supportsRealtime: boolean
  /** Declared soft rate limit (requests/minute); null = unspecified. */
  rateLimitPerMinute: number | null
  mocked: boolean
  /** True when the adapter is wired for future live use but not active yet. */
  futureSlot: boolean
}

export interface ProviderHealthSnapshot {
  providerId: string
  status: ProviderHealthStatus
  consecutiveFailures: number
  consecutiveSuccesses: number
  totalRequests: number
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastErrorCode: ProviderErrorCode | null
  rateLimitedUntil: string | null
}

export interface NormalizedProviderError {
  code: ProviderErrorCode
  message: string
  retryable: boolean
  rateLimited: boolean
  retryAfterMs: number | null
}

export interface ProviderMetadata {
  id: KnownProviderId | string
  displayName: string
  domains: AggregatableDomain[]
  /** Higher = preferred when selecting / ranking */
  priority: number
  /** Baseline reliability 0..1 used in confidence scoring */
  reliability: number
  mocked: boolean
  /** When true, adapter exists for capability discovery but is not used by default selection. */
  futureSlot?: boolean
}

export interface AggregationQuery {
  domain: AggregatableDomain
  input: Record<string, unknown>
  locale: 'ar' | 'en'
  signal?: AbortSignal
  /** Optional per-query override (e.g. flights → Amadeus then mock). */
  selectionStrategy?: ProviderSelectionStrategy
}

export interface ProviderFetchResult {
  providerId: string
  status: ProviderFetchStatus
  items: NormalizedOffer[]
  error?: string | null
  errorCode?: ProviderErrorCode | null
  durationMs: number
  attempt?: number
  retryAfterMs?: number | null
}

export interface NormalizedOffer {
  domain: AggregatableDomain
  /** Stable key used for deduplication across providers */
  fingerprint: string
  title: string
  price: number | null
  currency: string | null
  confidence: number
  providerId: string
  rankScore: number
  scoreHints: {
    priceCompetitiveness?: number
    durationQuality?: number
    rating?: number
    relevance?: number
  }
  payload: Record<string, unknown>
}

/**
 * Common interface every domain provider must implement.
 * Travel Agent never imports concrete vendors — only this contract.
 */
export interface ProviderAdapter {
  readonly metadata: ProviderMetadata
  isAvailable(): boolean
  supports(domain: AggregatableDomain): boolean
  getCapabilities(): ProviderCapabilities
  getHealth(): ProviderHealthSnapshot
  fetch(query: AggregationQuery): Promise<ProviderFetchResult>
}

export interface ProviderSelectionOptions {
  domain: AggregatableDomain
  strategy?: ProviderSelectionStrategy
  /** Include futureSlot adapters (usually false). */
  includeFutureSlots?: boolean
  /** Skip providers currently rate-limited / unhealthy. */
  excludeUnhealthy?: boolean
}

export interface ProviderRegistry {
  list(): ProviderMetadata[]
  get(id: string): ProviderAdapter | undefined
  register(adapter: ProviderAdapter): void
  forDomain(domain: AggregatableDomain): ProviderAdapter[]
  /** Capability-aware selection with priority sorting. */
  select(options: ProviderSelectionOptions): ProviderAdapter[]
  discoverCapabilities(domain?: AggregatableDomain): ProviderCapabilities[]
  getHealthStatus(providerId?: string): ProviderHealthSnapshot[]
  recordOutcome(providerId: string, result: ProviderFetchResult): void
}

export interface AggregationResult {
  domain: AggregatableDomain
  items: NormalizedOffer[]
  providerResults: Array<{
    providerId: string
    status: ProviderFetchResult['status']
    count: number
    error?: string | null
    errorCode?: ProviderErrorCode | null
    durationMs: number
    attempt?: number
  }>
  averageConfidence: number
  meta: {
    durationMs: number
    providersQueried: number
    providersSucceeded: number
    duplicatesRemoved: number
    selectionStrategy: ProviderSelectionStrategy
    retries: number
    fallbacksUsed: number
  }
}

export interface AggregationEngine {
  aggregate(query: AggregationQuery): Promise<AggregationResult>
}

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
}

export interface RateLimitPolicy {
  /** Default declared limit when adapter does not specify one. */
  defaultPerMinute: number
  /** Cool-down applied when a rate_limited response is seen. */
  coolDownMs: number
}
