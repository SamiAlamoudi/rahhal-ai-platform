/**
 * Multi-provider aggregation contracts.
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

export type KnownProviderId =
  | 'amadeus'
  | 'duffel'
  | 'booking_com'
  | 'expedia'
  | 'google_maps'
  | 'openstreetmap'
  | 'openweather'
  | 'exchangerate'
  | 'visa_info'
  | 'attractions_catalog'

export interface ProviderMetadata {
  id: KnownProviderId | string
  displayName: string
  domains: AggregatableDomain[]
  /** Higher = preferred when confidence ties */
  priority: number
  /** Baseline reliability 0..1 used in confidence scoring */
  reliability: number
  mocked: boolean
}

export interface AggregationQuery {
  domain: AggregatableDomain
  input: Record<string, unknown>
  locale: 'ar' | 'en'
  signal?: AbortSignal
}

export interface ProviderFetchResult {
  providerId: string
  status: 'ok' | 'error' | 'timeout' | 'skipped'
  items: NormalizedOffer[]
  error?: string | null
  durationMs: number
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

export interface ProviderAdapter {
  readonly metadata: ProviderMetadata
  isAvailable(): boolean
  supports(domain: AggregatableDomain): boolean
  fetch(query: AggregationQuery): Promise<ProviderFetchResult>
}

export interface ProviderRegistry {
  list(): ProviderMetadata[]
  get(id: string): ProviderAdapter | undefined
  register(adapter: ProviderAdapter): void
  forDomain(domain: AggregatableDomain): ProviderAdapter[]
}

export interface AggregationResult {
  domain: AggregatableDomain
  items: NormalizedOffer[]
  providerResults: Array<{
    providerId: string
    status: ProviderFetchResult['status']
    count: number
    error?: string | null
    durationMs: number
  }>
  averageConfidence: number
  meta: {
    durationMs: number
    providersQueried: number
    providersSucceeded: number
    duplicatesRemoved: number
  }
}

export interface AggregationEngine {
  aggregate(query: AggregationQuery): Promise<AggregationResult>
}
