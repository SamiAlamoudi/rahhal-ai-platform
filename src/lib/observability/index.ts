/**
 * Sprint 15 — Observability & Monitoring barrel.
 * Additive platform; feature flag `observability.platform` OFF by default.
 * Do not import from ChatPage hot paths (keeps ChatPage bundle unchanged).
 */

export { OBSERVABILITY_PLATFORM_VERSION } from './types'
export type {
  AlertEvaluation,
  AlertRule,
  AlertSeverity,
  CorrelationContext,
  HealthCheckResult,
  HealthReport,
  HealthStatus,
  LatencyStats,
  LogLevel,
  MetricSample,
  MetricsSnapshot,
  ObservabilityEvent,
  StructuredLogRecord,
  TraceDomain,
  TraceRecord,
  TraceSpan,
} from './types'

export {
  OBSERVABILITY_PLATFORM_FEATURE_ID,
  isObservabilityPlatformEnabled,
} from './feature'

export {
  CorrelationIdManager,
  getCorrelationIdManager,
  resetCorrelationIdManagerForTests,
} from './CorrelationIdManager'

export {
  Logger,
  createLogger,
  getLogger,
  resetLoggerForTests,
} from './Logger'

export {
  MetricsCollector,
  createMetricsCollector,
  getMetricsCollector,
  resetMetricsCollectorForTests,
} from './MetricsCollector'

export {
  Tracer,
  createTracer,
  getTracer,
  resetTracerForTests,
} from './Tracer'

export {
  HealthMonitor,
  createHealthMonitor,
  getHealthMonitor,
  resetHealthMonitorForTests,
} from './HealthMonitor'

export {
  EventRecorder,
  createEventRecorder,
  getEventRecorder,
  resetEventRecorderForTests,
} from './EventRecorder'

export {
  DEFAULT_ALERT_RULES,
  AlertEngine,
  getAlertEngine,
  resetAlertEngineForTests,
} from './alerts'

export {
  buildPerformanceSummary,
  renderPerformanceDashboardMarkdown,
  type PerformanceSummary,
} from './dashboard'

export {
  ObservabilityPlatform,
  getObservabilityPlatform,
  resetObservabilityPlatformForTests,
} from './ObservabilityPlatform'
