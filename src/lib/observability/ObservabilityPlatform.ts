/**
 * Sprint 15 — facade wiring Logger / Metrics / Tracer / Health / Events / Correlation.
 */

import { getAlertEngine } from './alerts'
import { getCorrelationIdManager } from './CorrelationIdManager'
import { createLogger, getLogger, type Logger } from './Logger'
import { createEventRecorder, getEventRecorder, type EventRecorder } from './EventRecorder'
import { createHealthMonitor, getHealthMonitor, type HealthMonitor } from './HealthMonitor'
import { createMetricsCollector, getMetricsCollector, type MetricsCollector } from './MetricsCollector'
import { createTracer, getTracer, type Tracer } from './Tracer'
import { buildPerformanceSummary, renderPerformanceDashboardMarkdown } from './dashboard'
import { isObservabilityPlatformEnabled } from './feature'
import { OBSERVABILITY_PLATFORM_VERSION } from './types'
import type { CorrelationIdManager } from './CorrelationIdManager'

export interface ObservabilityPlatformOptions {
  enabled?: boolean
}

export class ObservabilityPlatform {
  readonly logger: Logger
  readonly metrics: MetricsCollector
  readonly tracer: Tracer
  readonly health: HealthMonitor
  readonly events: EventRecorder
  readonly correlation: CorrelationIdManager
  private readonly enabledOverride: boolean | undefined

  constructor(options: ObservabilityPlatformOptions = {}) {
    this.enabledOverride = options.enabled
    const enabled = options.enabled
    this.logger = createLogger({ enabled })
    this.metrics = createMetricsCollector({ enabled })
    this.tracer = createTracer({ enabled, metrics: this.metrics })
    this.health = createHealthMonitor({ enabled })
    this.events = createEventRecorder({ enabled })
    this.correlation = getCorrelationIdManager()
  }

  isEnabled(): boolean {
    return isObservabilityPlatformEnabled({ enabled: this.enabledOverride })
  }

  diagnostics(): {
    version: string
    enabled: boolean
    metricsRequestCount: number
    traceCount: number
    healthOverall: string
  } {
    return {
      version: OBSERVABILITY_PLATFORM_VERSION,
      enabled: this.isEnabled(),
      metricsRequestCount: this.metrics.snapshot().requestCount,
      traceCount: this.tracer.listTraces().length,
      healthOverall: this.health.report().overall,
    }
  }

  dashboardMarkdown(): string {
    return renderPerformanceDashboardMarkdown(buildPerformanceSummary())
  }

  evaluateAlerts() {
    return getAlertEngine().evaluate()
  }
}

let shared: ObservabilityPlatform | null = null

export function getObservabilityPlatform(options?: ObservabilityPlatformOptions): ObservabilityPlatform {
  if (options) return new ObservabilityPlatform(options)
  if (!shared) shared = new ObservabilityPlatform()
  return shared
}

export function resetObservabilityPlatformForTests(): void {
  shared = null
  getLogger().clear()
  getMetricsCollector().reset()
  getTracer().reset()
  getHealthMonitor().reset()
  getEventRecorder().reset()
  getAlertEngine().reset()
  getCorrelationIdManager().reset()
}
