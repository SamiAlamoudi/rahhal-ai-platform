/**
 * Sprint 15 — Observability & Monitoring contracts.
 */

export const OBSERVABILITY_PLATFORM_VERSION = '1.0.0-observability-platform'

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

export type TraceDomain =
  | 'conversation'
  | 'planner'
  | 'journey'
  | 'providers'
  | 'maps'
  | 'flights'
  | 'hotels'
  | 'payments'
  | 'action_engine'
  | 'system'

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export interface CorrelationContext {
  requestId: string
  conversationId: string | null
  provider: string | null
  module: string | null
}

export interface StructuredLogRecord {
  level: LogLevel
  message: string
  timestamp: string
  requestId: string
  conversationId: string | null
  provider: string | null
  module: string | null
  durationMs: number | null
  status: string | null
  fields?: Record<string, unknown>
}

export interface MetricSample {
  name: string
  value: number
  at: string
  tags?: Record<string, string>
}

export interface LatencyStats {
  count: number
  averageMs: number
  p95Ms: number
  p99Ms: number
  minMs: number
  maxMs: number
}

export interface TraceSpan {
  spanId: string
  parentSpanId: string | null
  name: string
  domain: TraceDomain
  startedAt: string
  endedAt: string | null
  durationMs: number | null
  status: 'ok' | 'error' | 'timeout' | 'cancelled' | 'running'
  attributes: Record<string, string | number | boolean | null>
}

export interface TraceRecord {
  traceId: string
  requestId: string
  conversationId: string | null
  spans: TraceSpan[]
  status: 'ok' | 'error' | 'partial' | 'running'
  startedAt: string
  endedAt: string | null
  totalDurationMs: number | null
}

export interface HealthCheckResult {
  name: string
  status: HealthStatus
  detail: string
  checkedAt: string
  latencyMs: number | null
  metrics?: Record<string, number>
}

export interface HealthReport {
  overall: HealthStatus
  checkedAt: string
  checks: HealthCheckResult[]
}

export interface ObservabilityEvent {
  id: string
  type: string
  at: string
  requestId: string
  conversationId: string | null
  payload: Record<string, unknown>
}

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AlertRule {
  id: string
  name: string
  description: string
  severity: AlertSeverity
  /** Metric name or synthetic signal */
  signal: string
  threshold: number
  comparator: 'gt' | 'gte' | 'lt' | 'lte'
  enabled: boolean
}

export interface AlertEvaluation {
  ruleId: string
  triggered: boolean
  value: number
  threshold: number
  severity: AlertSeverity
  at: string
  message: string
}

export interface MetricsSnapshot {
  requestsPerSec: number
  averageLatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  providerFailureCount: number
  providerTimeoutCount: number
  conversationStarted: number
  conversationCompleted: number
  conversationCompletionRate: number
  cacheHits: number
  cacheMisses: number
  cacheHitRatio: number
  featureFlagUsage: Record<string, number>
  requestCount: number
}
