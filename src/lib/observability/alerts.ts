/**
 * Sprint 15 — alert rule definitions (no external alerting integration).
 */

import { getHealthMonitor } from './HealthMonitor'
import { getMetricsCollector } from './MetricsCollector'
import type { AlertEvaluation, AlertRule } from './types'

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'high_latency_p95',
    name: 'High latency',
    description: 'P95 request latency exceeds threshold',
    severity: 'warning',
    signal: 'p95LatencyMs',
    threshold: 2000,
    comparator: 'gt',
    enabled: true,
  },
  {
    id: 'provider_failures',
    name: 'Provider failures',
    description: 'Provider failure count exceeds threshold',
    severity: 'critical',
    signal: 'providerFailureCount',
    threshold: 5,
    comparator: 'gte',
    enabled: true,
  },
  {
    id: 'authentication_failures',
    name: 'Authentication failures',
    description: 'Auth failure signal exceeds threshold',
    severity: 'critical',
    signal: 'authFailureCount',
    threshold: 3,
    comparator: 'gte',
    enabled: true,
  },
  {
    id: 'conversation_failures',
    name: 'Conversation failures',
    description: 'Conversation completion rate drops below threshold',
    severity: 'warning',
    signal: 'conversationCompletionRate',
    threshold: 0.5,
    comparator: 'lt',
    enabled: true,
  },
  {
    id: 'memory_pressure',
    name: 'Memory pressure',
    description: 'Memory health degraded',
    severity: 'warning',
    signal: 'memoryPressure',
    threshold: 1,
    comparator: 'gte',
    enabled: true,
  },
  {
    id: 'unexpected_restart',
    name: 'Unexpected restart',
    description: 'Process restart detected within window',
    severity: 'info',
    signal: 'unexpectedRestart',
    threshold: 1,
    comparator: 'gte',
    enabled: true,
  },
]

function compare(value: number, threshold: number, comparator: AlertRule['comparator']): boolean {
  switch (comparator) {
    case 'gt': return value > threshold
    case 'gte': return value >= threshold
    case 'lt': return value < threshold
    case 'lte': return value <= threshold
    default: return false
  }
}

export class AlertEngine {
  private readonly rules: AlertRule[]
  private authFailureCount = 0

  constructor(rules: AlertRule[] = DEFAULT_ALERT_RULES) {
    this.rules = rules.map((r) => ({ ...r }))
  }

  recordAuthFailure(): void {
    this.authFailureCount += 1
  }

  listRules(): AlertRule[] {
    return this.rules.map((r) => ({ ...r }))
  }

  resolveSignal(signal: string): number {
    const metrics = getMetricsCollector().snapshot()
    const health = getHealthMonitor()
    switch (signal) {
      case 'p95LatencyMs': return metrics.p95LatencyMs
      case 'providerFailureCount': return metrics.providerFailureCount
      case 'authFailureCount': return this.authFailureCount
      case 'conversationCompletionRate':
        return metrics.conversationStarted === 0 ? 1 : metrics.conversationCompletionRate
      case 'memoryPressure':
        return health.report().checks.find((c) => c.name === 'memory')?.status === 'degraded' ? 1 : 0
      case 'unexpectedRestart':
        return health.getLastRestartAt() ? 1 : 0
      default: return 0
    }
  }

  evaluate(): AlertEvaluation[] {
    const at = new Date().toISOString()
    return this.rules.filter((r) => r.enabled).map((rule) => {
      const value = this.resolveSignal(rule.signal)
      const triggered = compare(value, rule.threshold, rule.comparator)
      return {
        ruleId: rule.id,
        triggered,
        value,
        threshold: rule.threshold,
        severity: rule.severity,
        at,
        message: triggered
          ? `${rule.name}: ${rule.signal}=${value} (threshold ${rule.comparator} ${rule.threshold})`
          : `${rule.name}: ok`,
      }
    })
  }

  reset(): void {
    this.authFailureCount = 0
  }
}

let shared: AlertEngine | null = null

export function getAlertEngine(): AlertEngine {
  if (!shared) shared = new AlertEngine()
  return shared
}

export function resetAlertEngineForTests(): void {
  shared?.reset()
  shared = null
}
