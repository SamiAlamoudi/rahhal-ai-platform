/**
 * Sprint 71 — Provider Runtime contracts.
 * Additive wrapper over Live Provider SDK — no engine rewrites.
 */

export type ProviderRuntimeId = 'amadeus' | 'duffel' | 'booking' | 'mock'

export type ProviderRuntimeMode = 'live' | 'mock' | 'unavailable'

export type ProviderRuntimeDomain = 'flights' | 'hotels' | 'generic'

export interface ProviderRuntimeCapabilities {
  flights: boolean
  hotels: boolean
  book: boolean
  cancel: boolean
  refresh: boolean
}

export interface ProviderRuntimeHealth {
  providerId: ProviderRuntimeId
  available: boolean
  mode: ProviderRuntimeMode
  latencyMs: number
  availability: number
  failures: number
  retries: number
  quotaUsed: number
  quotaLimit: number
  circuitState: 'closed' | 'open' | 'half_open'
  detail: string
}

export interface ProviderRuntimeAuthResult {
  ok: boolean
  mode: ProviderRuntimeMode
  detail: string
}

export interface ProviderRuntimeSearchRequest {
  domain: ProviderRuntimeDomain
  origin?: string
  destination?: string
  departureDate?: string
  returnDate?: string | null
  checkIn?: string
  checkOut?: string | null
  adults?: number
  /** Integration Sprint 2 — children count for live Amadeus/Duffel. */
  children?: number
  /** Integration Sprint 2 — cabin class hint (economy / business / …). */
  cabin?: string | null
  currency?: string
  signal?: AbortSignal
}

export interface ProviderRuntimeSearchResult {
  ok: boolean
  providerId: ProviderRuntimeId
  mode: ProviderRuntimeMode
  offers: unknown[]
  latencyMs: number
  error?: string
  gracefulMessage?: string
}

export interface ProviderRuntimeBookRequest {
  offerId: string
  domain?: ProviderRuntimeDomain
  signal?: AbortSignal
}

export interface ProviderRuntimeBookResult {
  ok: boolean
  providerId: ProviderRuntimeId
  orderId?: string
  error?: string
  retryable?: boolean
  gracefulMessage?: string
}

export interface ProviderRuntimeCancelRequest {
  orderId: string
  signal?: AbortSignal
}

export interface ProviderRuntimeCancelResult {
  ok: boolean
  providerId: ProviderRuntimeId
  error?: string
  gracefulMessage?: string
}

export interface ProviderRuntimeRefreshRequest {
  orderId: string
  signal?: AbortSignal
}

export interface ProviderRuntimeRefreshResult {
  ok: boolean
  providerId: ProviderRuntimeId
  order?: unknown
  error?: string
  gracefulMessage?: string
}

/** Unified provider surface required by Sprint 71. */
export interface ProviderRuntimeAdapter {
  readonly providerId: ProviderRuntimeId
  readonly displayName: string
  initialize(): Promise<void>
  authenticate(): Promise<ProviderRuntimeAuthResult>
  health(): ProviderRuntimeHealth
  capabilities(): ProviderRuntimeCapabilities
  search(request: ProviderRuntimeSearchRequest): Promise<ProviderRuntimeSearchResult>
  book(request: ProviderRuntimeBookRequest): Promise<ProviderRuntimeBookResult>
  cancel(request: ProviderRuntimeCancelRequest): Promise<ProviderRuntimeCancelResult>
  refresh(request: ProviderRuntimeRefreshRequest): Promise<ProviderRuntimeRefreshResult>
}

export interface ProviderSecretDiagnostic {
  providerId: ProviderRuntimeId
  requiredKeys: string[]
  presentKeys: string[]
  missingKeys: string[]
  ok: boolean
  detail: string
}

export interface ProviderFailoverResult<T> {
  ok: boolean
  result: T | null
  attempted: ProviderRuntimeId[]
  usedProviderId: ProviderRuntimeId | null
  gracefulMessage?: string
}

export const SPRINT71_PROVIDER_RUNTIME_VERSION = '1.0.0-runtime'

export const GRACEFUL_PROVIDER_MESSAGE =
  'تعذر إكمال الطلب عبر مزود السفر الآن. نعرض نتائج احتياطية آمنة — يمكنك المحاولة لاحقاً.'
