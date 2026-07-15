/**
 * Phase AI — Production Readiness v1 public surface.
 */

export {
  type LiveCapability,
  type LiveCapabilityFlags,
  resolveLiveCapabilityFlags,
  isLiveCapabilityEnabled,
  assertSafeLiveDefaults,
} from './liveCapabilityFlags'

export {
  type TimeoutConfig,
  type RateLimitConfig,
  type AppConfig,
  loadAppConfig,
  getAppConfig,
  resetAppConfig,
  setAppConfigForTests,
  resolveDeployTarget,
} from './appConfig'

export {
  type RetryPolicy,
  type RetryPolicyConfig,
  type RetryPolicyName,
  DEFAULT_RETRY_POLICIES,
  getRetryPolicy,
  withConfiguredRetry,
} from './retryPolicy'

export {
  type CircuitState,
  type CircuitBreakerOptions,
  type CircuitBreakerSnapshot,
  type CircuitBreaker,
  createOpsCircuitBreaker,
  getOpsCircuitBreaker,
  resetOpsCircuitBreaker,
} from './circuitBreaker'

export {
  type TraceSpan,
  type TracerProvider,
  RecordingTracerProvider,
  setTracerProvider,
  getTracerProvider,
  startSpan,
  withSpan,
  resetTracerProvider,
} from './tracing'

export {
  type ErrorTaxonomyCategory,
  type TaxonomyError,
  taxonomyCategoryForCode,
  classifyError,
  taxonomyFromAppError,
} from './errorTaxonomy'

export {
  correlationHeaderName,
  correlationIdFromHeaders,
  applyCorrelationToHeaders,
  runWithCorrelation,
} from './correlationPropagation'

export {
  type ProductionMetricName,
  recordRequestDuration,
  recordPlanningDuration,
  recordBookingDuration,
  recordFailure,
  recordRetry,
  recordCancellation,
  timeAsync,
} from './runtimeMetrics'

export { syncFeatureRegistryFromCapabilities } from './syncFeatureRegistry'

export {
  sanitizeInput,
  validateDestination,
  SECURITY_HEADERS,
  buildCorsPolicy,
  assertRequestSize,
  validateNonEmptyString,
  escapeHtml,
  rejectSensitivePayloadFields,
  type CorsPolicy,
} from './securityHelpers'
