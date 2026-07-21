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
  collectMonitoringSnapshot,
  recordFrontendError,
  recordAuthFailure,
  recordDatabaseError,
  recordEdgeFunctionFailure,
  recordBookingFailure,
  recordPaymentMockFailure,
  recordTicketingFailure,
  recordNotificationFailure,
  recordSlowRequest,
  recordQueueBacklog,
  recordSecretValidationFailure,
  recordAppUnavailable,
  type MonitoringSnapshot,
  type MonitoringOptions,
  type AffectedService,
} from './observability/monitoring'

export {
  type AlertSeverity,
  type AlertConditionId,
  type AlertEvent,
  type AlertSink,
  ALERT_SEVERITY_ORDER,
  DEFAULT_ALERT_RULES,
  evaluateAlertRules,
  highestSeverity,
  MockAlertDispatcher,
  CompositeAlertDispatcher,
  getAlertDispatcher,
  setAlertDispatcher,
  resetAlertDispatcher,
  dispatchAlerts,
} from './alerting'

export {
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentTimelineEntry,
  type IncidentRecord,
  INCIDENT_STATUS_TRANSITIONS,
  canTransitionIncidentStatus,
  IncidentRepository,
  getIncidentRepository,
  resetIncidentRepository,
  IncidentManager,
  getIncidentManager,
  resetIncidentManager,
} from './incidents'

export {
  type FeedbackKind,
  type FeedbackPriority,
  type FeedbackStatus,
  type BugReport,
  type FeatureRequest,
  type UserRating,
  type UsabilityIssue,
  type FeedbackPayload,
  type FeedbackRecord,
  type SubmitFeedbackInput,
  FeedbackRepository,
  getFeedbackRepository,
  resetFeedbackRepository,
  FeedbackManager,
  getFeedbackManager,
  resetFeedbackManager,
} from './feedback'

export {
  type ReleaseAction,
  type PatchReleaseDecision,
  type PatchReleaseInput,
  evaluatePatchRelease,
  shouldRollback,
  isPatchEligible,
} from './release'

export {
  validateEnvironment,
  assertValidEnvironment,
  type DeployTarget,
  type EnvironmentValidationResult,
} from './security/envValidation'
export {
  verifyPreviewEnvironment,
  type PreviewEnvCheckInput,
  type PreviewEnvCheckResult,
} from './preview'
export {
  SECURITY_HEADERS,
  buildSecurityHeaders,
  buildCorsPolicy,
  assertRequestSize,
  escapeHtml,
  validateNonEmptyString,
  checkDomainRateLimit,
  checkAuthBruteForce,
  DEFAULT_MAX_REQUEST_BYTES,
  type RateLimitDomain,
  type CorsPolicy,
  type SecurityHeaderOptions,
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

export { runStartup, type StartupOptions, type StartupResult } from './startup'
export {
  runProvidersCheck,
  type ProvidersCheckOptions,
  type ProvidersCheckResult,
} from './providersCheck'

/** Sprint 65 — Production Hardening & Go Live */
export {
  runSecurityAudit,
  auditFeatureFlags,
  auditProductionConfig,
  validateDataIntegrity,
  planRecovery,
  applyRetry,
  enqueueRecoveryFailure,
  timeDomain,
  timeDomainAsync,
  recordDomainTiming,
  recordRetry,
  recordTimeout,
  recordCacheHit,
  recordCacheMiss,
  recordWarning,
  installProviderLogBridge,
  isProviderLogBridgeInstalled,
  runDependencyChecks,
  generateProductionReadinessReport,
  isProductionGoLiveReady,
  installProductionHardening,
  PRODUCTION_V1_VERSION,
  PLATFORM_PACKAGE_VERSION,
  type SecurityAuditReport,
  type FeatureFlagAuditReport,
  type ConfigAuditReport,
  type IntegrityReport,
  type RecoveryPlan,
  type RecoveryScenario,
  type ProductionReadinessReport,
  type DomainTimerName,
  type DependencyCheckReport,
} from './production'

/** Sprint 66 — End-to-End Production Validation */
export {
  runProductionValidation,
  buildSystemReadinessReport,
  buildHealthDashboard,
  runFlow1ConversationSearch,
  runFlow2BookingTripDocuments,
  runFlow3SyncRefresh,
  runFlow4Cancellation,
  runFlow5MultiBooking,
  runFlow6ProviderFailure,
  runFlow7FeatureFlags,
  SPRINT66_VALIDATION_VERSION,
  type SystemReadinessReport,
  type ProductionHealthDashboard,
  type ValidationFlowResult,
  type ValidationFlowId,
  type ComponentHealth,
} from './validation'
