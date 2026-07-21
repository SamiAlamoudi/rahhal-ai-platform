/**
 * Sprint 71 — Live Provider Integration Framework (Provider Runtime).
 *
 * Additive wrapper over existing Live Provider SDK adapters.
 * Does not rewrite RahhalBrain, Booking Intelligence, or Booking Execution.
 */

export type {
  ProviderRuntimeId,
  ProviderRuntimeMode,
  ProviderRuntimeDomain,
  ProviderRuntimeCapabilities,
  ProviderRuntimeHealth,
  ProviderRuntimeAuthResult,
  ProviderRuntimeSearchRequest,
  ProviderRuntimeSearchResult,
  ProviderRuntimeBookRequest,
  ProviderRuntimeBookResult,
  ProviderRuntimeCancelRequest,
  ProviderRuntimeCancelResult,
  ProviderRuntimeRefreshRequest,
  ProviderRuntimeRefreshResult,
  ProviderRuntimeAdapter,
  ProviderSecretDiagnostic,
  ProviderFailoverResult,
} from './types'

export {
  SPRINT71_PROVIDER_RUNTIME_VERSION,
  GRACEFUL_PROVIDER_MESSAGE,
} from './types'

export {
  createProviderRetryPolicy,
  type RetryPolicyOptions,
  type RetryOutcome,
  type ProviderRetryPolicy,
} from './retryPolicy'

export {
  validateProviderSecrets,
  validateAllProviderSecrets,
} from './secretsDiagnostics'

export { ProviderRuntimeHealthMonitor } from './healthMonitor'
export { wrapLiveSdkAsRuntimeAdapter } from './wrapAdapter'
export {
  createMockRuntimeAdapter,
  createAmadeusRuntimeAdapter,
  createDuffelRuntimeAdapter,
  createBookingComRuntimeAdapter,
  type CreateRuntimeAdapterOptions,
} from './adapters'

export { buildFailoverChain, searchWithFailover } from './failover'

export {
  createProviderRuntimeRegistry,
  getDefaultProviderRuntimeRegistry,
  resetDefaultProviderRuntimeRegistry,
  type ProviderRuntimeRegistry,
  type ProviderRuntimeRegistryOptions,
} from './registry'
