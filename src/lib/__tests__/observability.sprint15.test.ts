/**
 * Sprint 15 — Observability & Monitoring tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  DEFAULT_ALERT_RULES,
  OBSERVABILITY_PLATFORM_FEATURE_ID,
  OBSERVABILITY_PLATFORM_VERSION,
  ObservabilityPlatform,
  buildPerformanceSummary,
  createHealthMonitor,
  createLogger,
  createMetricsCollector,
  createTracer,
  getAlertEngine,
  getMetricsCollector,
  getTracer,
  isObservabilityPlatformEnabled,
  renderPerformanceDashboardMarkdown,
  resetAlertEngineForTests,
  resetCorrelationIdManagerForTests,
  resetEventRecorderForTests,
  resetHealthMonitorForTests,
  resetLoggerForTests,
  resetMetricsCollectorForTests,
  resetObservabilityPlatformForTests,
  resetTracerForTests,
} from '../observability'

describe('Sprint 15 — Observability & Monitoring', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetObservabilityPlatformForTests()
    resetLoggerForTests()
    resetMetricsCollectorForTests()
    resetTracerForTests()
    resetHealthMonitorForTests()
    resetEventRecorderForTests()
    resetAlertEngineForTests()
    resetCorrelationIdManagerForTests()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetObservabilityPlatformForTests()
    resetLoggerForTests()
    resetMetricsCollectorForTests()
    resetTracerForTests()
    resetHealthMonitorForTests()
    resetEventRecorderForTests()
    resetAlertEngineForTests()
    resetCorrelationIdManagerForTests()
  })

  it('keeps observability.platform OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(OBSERVABILITY_PLATFORM_FEATURE_ID)).toBe(false)
    expect(isObservabilityPlatformEnabled()).toBe(false)
    expect(OBSERVABILITY_PLATFORM_VERSION).toMatch(/observability-platform/)
  })

  it('structured logging includes required fields and redacts secrets', () => {
    const logger = createLogger({ enabled: true, minLevel: 'TRACE' })
    const record = logger.info('hello', {
      durationMs: 12,
      status: 'ok',
      fields: {
        api_key: 'sk-abcdefghijklmnopqrstuvwxyz123456',
        password: 'hunter2!!',
        safe: 'value',
      },
    })
    expect(record).not.toBeNull()
    expect(record!.timestamp).toMatch(/T/)
    expect(record!.requestId).toBeTruthy()
    expect(record!.durationMs).toBe(12)
    expect(record!.status).toBe('ok')
    expect(JSON.stringify(record)).toContain('[REDACTED]')
    expect(JSON.stringify(record)).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456')
    expect(JSON.stringify(record)).not.toContain('hunter2')
    expect(() => logger.assertNoSensitiveLeaks(['sk-abcdefghijklmnopqrstuvwxyz123456'])).not.toThrow()
  })

  it('supports all log levels', () => {
    const logger = createLogger({ enabled: true, minLevel: 'TRACE' })
    for (const level of ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const) {
      expect(logger.log(level, `msg-${level}`)?.level).toBe(level)
    }
    expect(logger.list()).toHaveLength(6)
  })

  it('metrics collect latency percentiles, failures, cache, feature flags', () => {
    const metrics = createMetricsCollector({ enabled: true })
    for (let i = 1; i <= 100; i++) metrics.recordRequest(i)
    metrics.recordProviderFailure('amadeus')
    metrics.recordProviderTimeout('duffel')
    metrics.recordConversationStart()
    metrics.recordConversationStart()
    metrics.recordConversationComplete()
    metrics.recordCacheHit()
    metrics.recordCacheHit()
    metrics.recordCacheMiss()
    metrics.recordFeatureFlagUsage('observability.platform')
    const snap = metrics.snapshot()
    expect(snap.requestCount).toBe(100)
    expect(snap.averageLatencyMs).toBeGreaterThan(0)
    expect(snap.p95LatencyMs).toBeGreaterThanOrEqual(snap.averageLatencyMs)
    expect(snap.p99LatencyMs).toBeGreaterThanOrEqual(snap.p95LatencyMs)
    expect(snap.providerFailureCount).toBe(1)
    expect(snap.providerTimeoutCount).toBe(1)
    expect(snap.conversationCompletionRate).toBe(0.5)
    expect(snap.cacheHitRatio).toBeCloseTo(2 / 3, 5)
    expect(snap.featureFlagUsage['observability.platform']).toBe(1)
    expect(snap.requestsPerSec).toBeGreaterThan(0)
  })

  it('tracer covers full lifecycle domains', () => {
    const metrics = createMetricsCollector({ enabled: true })
    const tracer = createTracer({ enabled: true, metrics })
    const trace = tracer.recordLifecycleSkeleton({
      conversationId: 'c1',
      latenciesMs: {
        conversation: 5,
        planner: 4,
        journey: 3,
        providers: 10,
        maps: 2,
        flights: 8,
        hotels: 7,
        payments: 6,
        action_engine: 1,
      },
    })
    expect(trace).not.toBeNull()
    expect(trace!.spans.map((s) => s.domain)).toEqual([
      'conversation',
      'planner',
      'journey',
      'providers',
      'maps',
      'flights',
      'hotels',
      'payments',
      'action_engine',
    ])
    expect(trace!.spans.every((s) => s.durationMs != null && s.durationMs >= 0)).toBe(true)
    expect(trace!.totalDurationMs).not.toBeNull()
    expect(tracer.latencyBreakdown().providers).toBeGreaterThan(0)
  })

  it('health monitor exposes endpoint payloads', () => {
    const health = createHealthMonitor({ enabled: true })
    health.setProviderStatus('amadeus', 'healthy')
    const report = health.report()
    expect(report.checks.map((c) => c.name)).toEqual(expect.arrayContaining([
      'application',
      'providers',
      'database',
      'cache',
      'memory',
      'cpu',
      'disk',
      'queue',
    ]))
    const endpoints = health.endpointPayloads()
    expect(endpoints['/api/health']).toBeTruthy()
    expect(endpoints['/api/health/providers']).toBeTruthy()
    expect(endpoints['/api/health/database']).toBeTruthy()
    expect(endpoints['/api/health/memory']).toBeTruthy()
  })

  it('alert rules evaluate without external integrations', () => {
    expect(DEFAULT_ALERT_RULES.map((r) => r.id)).toEqual(expect.arrayContaining([
      'high_latency_p95',
      'provider_failures',
      'authentication_failures',
      'conversation_failures',
      'memory_pressure',
      'unexpected_restart',
    ]))

    getFeatureRegistry().setEnabled(OBSERVABILITY_PLATFORM_FEATURE_ID, true)
    resetMetricsCollectorForTests()
    resetAlertEngineForTests()

    const singleton = getMetricsCollector()
    for (let i = 0; i < 20; i++) singleton.recordRequest(3000)
    for (let i = 0; i < 6; i++) singleton.recordProviderFailure()
    getAlertEngine().recordAuthFailure()
    getAlertEngine().recordAuthFailure()
    getAlertEngine().recordAuthFailure()

    const evals = getAlertEngine().evaluate()
    expect(evals.some((e) => e.ruleId === 'high_latency_p95' && e.triggered)).toBe(true)
    expect(evals.some((e) => e.ruleId === 'provider_failures' && e.triggered)).toBe(true)
    expect(evals.some((e) => e.ruleId === 'authentication_failures' && e.triggered)).toBe(true)
  })

  it('dashboard builds performance summary markdown', () => {
    getFeatureRegistry().setEnabled(OBSERVABILITY_PLATFORM_FEATURE_ID, true)
    resetMetricsCollectorForTests()
    resetTracerForTests()
    const metrics = getMetricsCollector()
    metrics.recordRequest(10)
    metrics.recordConversationStart()
    metrics.recordConversationComplete()
    getTracer().recordLifecycleSkeleton()
    const summary = buildPerformanceSummary()
    expect(summary.metrics.requestCount).toBeGreaterThan(0)
    const md = renderPerformanceDashboardMarkdown(summary)
    expect(md).toContain('Performance Summary')
    expect(md).toContain('Latency Breakdown')
    expect(md).toContain('Provider Statistics')
    expect(md).toContain('Conversation Statistics')
    expect(md).toContain('Health Status')
  })

  it('platform facade wires components when enabled', () => {
    const platform = new ObservabilityPlatform({ enabled: true })
    platform.correlation.createRequestId()
    platform.correlation.setConversationId('conv-1')
    platform.logger.info('turn', { status: 'ok', durationMs: 3 })
    platform.metrics.recordRequest(3)
    platform.events.record('conversation.turn', { ok: true })
    platform.tracer.recordLifecycleSkeleton({ conversationId: 'conv-1' })
    const diag = platform.diagnostics()
    expect(diag.enabled).toBe(true)
    expect(diag.metricsRequestCount).toBeGreaterThan(0)
    expect(diag.traceCount).toBeGreaterThan(0)
    expect(platform.dashboardMarkdown()).toContain('Performance Dashboard')
  })

  it('stress: logger + metrics under budget', () => {
    const logger = createLogger({ enabled: true, minLevel: 'INFO' })
    const metrics = createMetricsCollector({ enabled: true })
    const started = Date.now()
    for (let i = 0; i < 2000; i++) {
      logger.info(`evt-${i}`, { durationMs: i % 50, status: 'ok', fields: { n: i } })
      metrics.recordRequest(i % 50)
    }
    expect(Date.now() - started).toBeLessThan(1000)
    expect(metrics.snapshot().requestCount).toBe(2000)
  })

  it('performance regression: lifecycle skeleton stays cheap', () => {
    const metrics = createMetricsCollector({ enabled: true })
    const tracer = createTracer({ enabled: true, metrics })
    const started = Date.now()
    for (let i = 0; i < 200; i++) {
      tracer.recordLifecycleSkeleton({ conversationId: `c-${i}` })
    }
    expect(Date.now() - started).toBeLessThan(1000)
    expect(tracer.listTraces().length).toBe(200)
  })

  it('regression: disabled platform is a no-op', () => {
    const platform = new ObservabilityPlatform({ enabled: false })
    expect(platform.logger.info('x')).toBeNull()
    expect(platform.tracer.startTrace()).toBeNull()
    expect(platform.events.record('x')).toBeNull()
    expect(platform.metrics.snapshot().requestCount).toBe(0)
  })
})
