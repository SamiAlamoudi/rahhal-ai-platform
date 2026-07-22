/**
 * Sprint 90 — Live Provider Integration Readiness (core barrel).
 * Additive infrastructure — does not modify AI engines or conversation.
 */

export {
  SPRINT90_PROVIDER_READINESS_VERSION,
  type ProviderMode,
  type ProviderPriorityTier,
  type CircuitBreakerState,
  type ProviderDomain,
  type ProviderLimits,
  type ProviderCapabilityMap,
  type ProviderHealthResult,
  type FlightSearchRequest,
  type HotelSearchRequest,
  type PackageSearchRequest,
  type ProviderSearchResult,
  type TravelProvider,
} from './types'

export {
  ProviderError,
  classifyProviderFailure,
  isRetryableCode,
  type ProviderErrorCode,
} from './ProviderErrors'

export {
  DEFAULT_PROVIDER_LIMITS,
  emptyCapabilities,
  mergeCapabilities,
  assertProviderSurface,
  describeCapabilities,
} from './ProviderCapabilities'

export {
  createProviderCircuitBreaker,
  type ProviderCircuitBreaker,
  type ProviderCircuitBreakerOptions,
  type CircuitBreakerSnapshot,
} from './ProviderCircuitBreaker'

export {
  createProviderRetryPolicy,
  shouldRetryProviderError,
  type ProviderRetryPolicyOptions,
  type ProviderRetryOutcome,
} from './ProviderRetryPolicy'

export {
  sortProvidersByPriority,
  executeWithFailover,
  type PrioritizedProvider,
  type FailoverAttempt,
  type FailoverResult,
} from './ProviderPriority'

export {
  validateProviderSecrets,
  apiKeyExists,
  PROVIDER_SECRET_KEYS,
  type SecretPresence,
  type SecretCheck,
  type ProviderSecretsReport,
  type SecretsValidatorInput,
} from './ProviderSecretsValidator'

export {
  probeProviderHealth,
  probeAllProviders,
  summarizeHealth,
  type HealthProbeOptions,
} from './ProviderHealth'

export {
  assertModeAllowed,
  checkSandboxReachable,
  resolveOperatingMode,
  type SandboxReachabilityResult,
} from './ProviderSandbox'

export {
  createProviderMetricsStore,
  type ProviderMetricsStore,
  type ProviderMetricsSnapshot,
} from './ProviderMetrics'

export {
  createProviderRegistry,
  type ProviderRegistry,
  type ProviderRegistryOptions,
  type ProviderRegistrySnapshot,
} from './ProviderRegistry'

export {
  createMockTravelProvider,
  createSandboxTravelProvider,
  createLiveStubTravelProvider,
  type MockTravelProviderOptions,
} from './mocks'
