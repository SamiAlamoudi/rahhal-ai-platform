/**
 * Production-grade Multi Provider architecture types.
 * Rahhal must never depend on a single travel supplier.
 */

export type TravelDomain =
  | 'flight'
  | 'hotel'
  | 'cars'
  | 'activities'
  | 'transfers'

/** Ordered supplier slots (configurable). */
export type MultiProviderId =
  | 'duffel'
  | 'travelport'
  | 'sabre'
  | 'amadeus_enterprise'
  | 'amadeus'
  | 'booking'
  | 'expedia'
  | 'hotelbeds'
  | 'rentalcars'
  | 'viator'
  | 'getyourguide'
  | 'mock'

export type FailoverReason =
  | 'timeout'
  | 'authentication'
  | 'quota'
  | 'unavailable'
  | 'empty'
  | 'error'
  | 'not_configured'

export type QuotaStatus = 'ok' | 'limited' | 'exhausted' | 'unknown'

export interface MultiProviderDescriptor {
  id: MultiProviderId
  displayName: string
  domains: TravelDomain[]
  /** Higher = tried earlier when priority numbers are used as tie-breakers. */
  defaultPriority: number
  mocked: boolean
  /** True when adapter is prepared but live credentials are not wired. */
  prepared: boolean
}

export interface ProviderAttemptRecord {
  providerId: MultiProviderId
  domain: TravelDomain
  success: boolean
  latencyMs: number
  reason: FailoverReason | null
  errorCode: string | null
  at: string
}

export interface ProviderHealthSnapshot {
  providerId: MultiProviderId
  domain: TravelDomain
  connected: boolean
  latencyMs: number | null
  errors: number
  fallbackCount: number
  quotaStatus: QuotaStatus
  lastError: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  prepared: boolean
  mocked: boolean
}

export interface DomainHealthSummary {
  domain: TravelDomain
  chain: MultiProviderId[]
  activeProviderId: MultiProviderId | null
  connected: boolean
  fallbackCount: number
  providers: ProviderHealthSnapshot[]
}

export interface MultiProviderHealthReport {
  checkedAt: string
  domains: DomainHealthSummary[]
  totals: {
    connected: number
    errors: number
    fallbackCount: number
  }
}

export interface ChainSearchResult<T> {
  success: boolean
  data: T | null
  providerId: MultiProviderId
  providerName: string
  source: 'real' | 'mock' | 'fallback'
  latencyMs: number
  attempts: ProviderAttemptRecord[]
  fallbackCount: number
  error: string | null
}

/** Contract every multi-provider adapter implements. */
export interface MultiProviderAdapter<T = unknown> {
  readonly id: MultiProviderId
  readonly displayName: string
  readonly domains: TravelDomain[]
  readonly mocked: boolean
  readonly prepared: boolean

  isConfigured(): boolean
  search(domain: TravelDomain, req: unknown): Promise<{
    success: boolean
    data: T | null
    latencyMs: number
    reason?: FailoverReason
    errorCode?: string
    errorMessage?: string
    quotaStatus?: QuotaStatus
  }>
}

export const DEFAULT_FLIGHT_CHAIN: MultiProviderId[] = [
  'duffel',
  'travelport',
  'sabre',
  'amadeus_enterprise',
  'mock',
]

export const DEFAULT_HOTEL_CHAIN: MultiProviderId[] = [
  'booking',
  'expedia',
  'hotelbeds',
  'mock',
]

export const DEFAULT_CARS_CHAIN: MultiProviderId[] = [
  'rentalcars',
  'mock',
]

export const DEFAULT_ACTIVITIES_CHAIN: MultiProviderId[] = [
  'viator',
  'getyourguide',
  'mock',
]

export const DEFAULT_TRANSFERS_CHAIN: MultiProviderId[] = [
  'mock',
]

export const PROVIDER_CATALOG: MultiProviderDescriptor[] = [
  { id: 'duffel', displayName: 'Duffel', domains: ['flight'], defaultPriority: 100, mocked: false, prepared: true },
  { id: 'travelport', displayName: 'Travelport', domains: ['flight'], defaultPriority: 90, mocked: false, prepared: true },
  { id: 'sabre', displayName: 'Sabre', domains: ['flight'], defaultPriority: 80, mocked: false, prepared: true },
  { id: 'amadeus_enterprise', displayName: 'Amadeus Enterprise', domains: ['flight'], defaultPriority: 70, mocked: false, prepared: true },
  { id: 'amadeus', displayName: 'Amadeus', domains: ['flight'], defaultPriority: 65, mocked: false, prepared: true },
  { id: 'booking', displayName: 'Booking.com', domains: ['hotel'], defaultPriority: 90, mocked: false, prepared: true },
  { id: 'expedia', displayName: 'Expedia', domains: ['hotel'], defaultPriority: 80, mocked: false, prepared: true },
  { id: 'hotelbeds', displayName: 'Hotelbeds', domains: ['hotel'], defaultPriority: 70, mocked: false, prepared: true },
  { id: 'rentalcars', displayName: 'RentalCars', domains: ['cars'], defaultPriority: 90, mocked: false, prepared: true },
  { id: 'viator', displayName: 'Viator', domains: ['activities'], defaultPriority: 90, mocked: false, prepared: true },
  { id: 'getyourguide', displayName: 'GetYourGuide', domains: ['activities'], defaultPriority: 80, mocked: false, prepared: true },
  { id: 'mock', displayName: 'Mock Provider', domains: ['flight', 'hotel', 'cars', 'activities', 'transfers'], defaultPriority: 1, mocked: true, prepared: false },
]
