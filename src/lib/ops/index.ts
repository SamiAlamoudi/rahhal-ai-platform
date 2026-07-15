export {
  maskEmail,
  maskPhone,
  maskMetadata,
  maskSensitiveString,
  assertNoSecretsInText,
} from './logging/mask'
export {
  createCorrelationId,
  getCorrelationId,
  setCorrelationId,
  withCorrelationId,
} from './logging/correlation'
export {
  StructuredLogger,
  getLogger,
  resetLogger,
  type LogLevel,
  type StructuredLogEvent,
} from './logging/structuredLogger'

export {
  AppError,
  toAppError,
  userMessageForCode,
  statusForCode,
  type AppErrorCode,
} from './errors/canonicalError'
export { installGlobalErrorHandlers } from './errors/globalHandlers'

export {
  OpsMetricsRegistry,
  getOpsMetrics,
  resetOpsMetrics,
  recordProviderOutcome,
  type OpsMetricName,
  type OpsMetricsSnapshot,
} from './observability/metricsRegistry'
export {
  checkLiveness,
  checkReadiness,
  checkHealth,
  type ProbeResult,
  type ProbeStatus,
  type HealthProbeOptions,
} from './observability/health'

export {
  validateEnvironment,
  assertValidEnvironment,
  type DeployTarget,
  type EnvironmentValidationResult,
} from './security/envValidation'
export {
  SECURITY_HEADERS,
  buildCorsPolicy,
  assertRequestSize,
  escapeHtml,
  validateNonEmptyString,
  checkDomainRateLimit,
  checkAuthBruteForce,
  DEFAULT_MAX_REQUEST_BYTES,
  type RateLimitDomain,
  type CorsPolicy,
} from './security/securityPolicy'

export {
  IdempotencyStore,
  getIdempotencyStore,
  resetIdempotencyStore,
} from './reliability/idempotency'
export {
  createRetryBudget,
  canRetry,
  consumeRetry,
  createTimeoutBudget,
  remainingTimeoutMs,
  isTimeoutBudgetExhausted,
  createStaleRequestController,
} from './reliability/budgets'
export {
  GracefulShutdown,
  getGracefulShutdown,
  resetGracefulShutdown,
  shouldGracefullyDegrade,
} from './reliability/gracefulShutdown'
export {
  DeadLetterQueue,
  getDeadLetterQueue,
  resetDeadLetterQueue,
  type DeadLetterItem,
} from './reliability/deadLetter'
export {
  checkFlowConsistency,
  type ConsistencySubject,
  type ConsistencyReport,
} from './reliability/consistency'

export {
  PERFORMANCE_BUDGETS,
  RequestDeduper,
  TtlCache,
  logSlowOperation,
  installLongTaskDetector,
  estimateMemoryPressure,
} from './performance/performanceToolkit'

export {
  runStartup,
  requestGracefulShutdown,
  type StartupOptions,
  type StartupResult,
} from './startup'

/** Phase AI — Production Readiness v1 */
export {
  type LiveCapability,
  type LiveCapabilityFlags,
  resolveLiveCapabilityFlags,
  isLiveCapabilityEnabled,
  assertSafeLiveDefaults,
  type TimeoutConfig,
  type RateLimitConfig,
  type AppConfig,
  loadAppConfig,
  getAppConfig,
  resetAppConfig,
  setAppConfigForTests,
  resolveDeployTarget,
  type RetryPolicy,
  type RetryPolicyConfig,
  type RetryPolicyName,
  DEFAULT_RETRY_POLICIES,
  getRetryPolicy,
  withConfiguredRetry,
  type CircuitState,
  type CircuitBreakerOptions,
  type CircuitBreakerSnapshot,
  type CircuitBreaker,
  createOpsCircuitBreaker,
  getOpsCircuitBreaker,
  resetOpsCircuitBreaker,
  type TraceSpan,
  type TracerProvider,
  RecordingTracerProvider,
  setTracerProvider,
  getTracerProvider,
  startSpan,
  withSpan,
  resetTracerProvider,
  type ErrorTaxonomyCategory,
  type TaxonomyError,
  taxonomyCategoryForCode,
  classifyError,
  taxonomyFromAppError,
  correlationHeaderName,
  correlationIdFromHeaders,
  applyCorrelationToHeaders,
  runWithCorrelation,
  type ProductionMetricName,
  recordRequestDuration,
  recordPlanningDuration,
  recordBookingDuration,
  recordFailure,
  recordRetry,
  recordCancellation,
  timeAsync,
  syncFeatureRegistryFromCapabilities,
  rejectSensitivePayloadFields,
  sanitizeInput,
} from './production'
