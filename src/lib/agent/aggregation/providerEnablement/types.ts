/**
 * Phase AJ — Live Provider Enablement Preparation types.
 */

export type ProviderCapability =
  | 'flights'
  | 'hotels'
  | 'maps'
  | 'weather'
  | 'transport'
  | 'activities'

export type ProviderEnvironment = 'mock' | 'sandbox' | 'production'

export type ProviderId =
  | 'amadeus'
  | 'booking_com'
  | 'google_maps'
  | 'openweather'
  | 'transport_mock'
  | 'activities_mock'
  | 'amadeus_mock'
  | 'booking_com_mock'
  | 'google_maps_mock'
  | 'openweather_mock'

export interface ProviderRateLimitPolicy {
  maxRequests: number
  windowMs: number
}

export interface ProviderRetryPolicyRef {
  /** References AppConfig retry policy name or inline. */
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
}

export interface ProviderCircuitBreakerPolicy {
  failureThreshold: number
  openMs: number
  halfOpenSuccesses: number
}

export type HealthCheckStrategy = 'config_only' | 'sandbox_probe' | 'none'

export interface ProviderRegistryEntry {
  providerId: ProviderId
  capability: ProviderCapability
  /** Capability-level live flag id (e.g. providers.flights.live). */
  capabilityFlag: string
  /** Default environment when live — sandbox unless production host configured. */
  environment: ProviderEnvironment
  priority: number
  fallbackProviderId: ProviderId | null
  timeoutMs: number
  retryPolicy: ProviderRetryPolicyRef
  rateLimitPolicy: ProviderRateLimitPolicy
  circuitBreakerPolicy: ProviderCircuitBreakerPolicy
  healthCheckStrategy: HealthCheckStrategy
  /** Secret env var NAMES only — never values. */
  requiredSecretNames: string[]
  optionalConfigFields: string[]
  supportedRegions: string[] | 'global'
  /** Whether a live adapter implementation exists. */
  liveAdapterAvailable: boolean
  selectionEnvKeys: string[]
}

export interface CapabilityEnablement {
  live: boolean
  /** Selected provider id for the capability (mock or live). */
  provider: string
}

export interface ProviderEnablementFlags {
  /** Master live switch (Phase W / Phase AI). */
  masterLive: boolean
  /** Allow mock fallback when live fails (default true). */
  mockFallbackEnabled: boolean
  /** When true, readiness/selection failure returns error instead of mock. */
  strictLive: boolean
  capabilities: Record<ProviderCapability, CapabilityEnablement>
}

export interface SecretPresenceResult {
  name: string
  present: boolean
  /** Masked hint only — never the value. */
  masked: string
  /** True when a forbidden VITE_* variant is set. */
  forbiddenClientExposure: boolean
}

export interface ProviderReadinessResult {
  provider: ProviderId
  capability: ProviderCapability
  configured: boolean
  enabled: boolean
  environment: ProviderEnvironment
  healthy: boolean
  reason: string
  fallbackAvailable: boolean
  checkedAt: string
  secrets: SecretPresenceResult[]
  circuitState?: 'closed' | 'open' | 'half_open' | 'unknown'
  selectionReason?: string
}

export type SelectionOutcome =
  | 'mock_default'
  | 'live_selected'
  | 'fallback_mock'
  | 'strict_live_rejected'
  | 'not_configured'
  | 'flag_off'
  | 'circuit_open'
  | 'invalid_selection'

export interface ProviderSelectionDecision {
  capability: ProviderCapability
  requestedProvider: string
  selectedProviderId: ProviderId
  source: 'live' | 'mock'
  outcome: SelectionOutcome
  reason: string
  fallbackUsed: boolean
  readiness: ProviderReadinessResult | null
}
