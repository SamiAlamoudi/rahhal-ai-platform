/**
 * Sprint 80 P1-3 — Unified conversational travel search provider contracts.
 *
 * Additive. Does not replace Flight/Hotel Search Engines or live Gateway paths.
 * Future domains (cars, activities, …) share the same interface surface.
 */

export const CONVERSATIONAL_PROVIDER_UNIFY_VERSION = '1.0.0-conversational-provider-unify'

/** Search domains that share the conversational provider interface. */
export type ConversationalProviderDomain = 'flights' | 'hotels' | 'cars' | 'activities'

export type ConversationalProviderId =
  | 'mock-flights'
  | 'mock-hotels'
  | 'live-flights'
  | 'live-hotels'
  | (string & {})

export type ConversationalProviderMode = 'mock' | 'live' | 'unavailable'

export interface ConversationalProviderCapabilities {
  domain: ConversationalProviderDomain
  search: boolean
  live: boolean
}

/** Domain-agnostic search request after Request Mapper normalization. */
export interface UnifiedProviderRequest {
  domain: ConversationalProviderDomain
  /** Opaque criteria bag — domain-specific fields live here. */
  criteria: Record<string, unknown>
  currency?: string
  adults?: number
  children?: number
  locale?: 'ar' | 'en'
  signal?: AbortSignal
  /** Correlation / cache key hint (optional). */
  requestId?: string
}

/** Single normalized offer for any domain. */
export interface UnifiedProviderOffer {
  id: string
  domain: ConversationalProviderDomain
  providerId: ConversationalProviderId
  title: string
  price: number | null
  currency: string
  score?: number
  /** Domain-specific payload preserved for tool / decision layers. */
  raw: Record<string, unknown>
}

export interface UnifiedProviderSearchResult {
  ok: boolean
  domain: ConversationalProviderDomain
  providerId: ConversationalProviderId
  mode: ConversationalProviderMode
  offers: UnifiedProviderOffer[]
  empty: boolean
  latencyMs: number
  /** Tool-shaped data compatible with existing flights/hotels tool contracts. */
  toolData: Record<string, unknown>
  gracefulMessage?: string
  error?: string
  errorCode?: ConversationalProviderErrorCode
}

export type ConversationalProviderErrorCode =
  | 'DISABLED'
  | 'INVALID_REQUEST'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK_FAILURE'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'EMPTY_INVENTORY'
  | 'UNKNOWN'

/**
 * Shared interface — flights, hotels, and future providers implement this.
 */
export interface ConversationalTravelProvider {
  readonly providerId: ConversationalProviderId
  readonly domain: ConversationalProviderDomain
  readonly displayName: string
  capabilities(): ConversationalProviderCapabilities
  /**
   * Whether this provider should be considered for resolution right now
   * (feature flags, secrets, forceMock, etc.).
   */
  isAvailable(options?: { enabled?: boolean }): boolean | Promise<boolean>
  search(request: UnifiedProviderRequest): Promise<UnifiedProviderSearchResult>
}

/** Tool-bridge shaped result (matches integration *toolBridge* return). */
export type ConversationalToolSearchResult = {
  data: Record<string, unknown>
  empty: boolean
  gracefulMessage?: string
}
