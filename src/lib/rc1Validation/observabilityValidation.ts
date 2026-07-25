/**
 * Sprint 18 — Observability platform validation (test overrides; flag stays OFF by default).
 */

import { ObservabilityPlatform } from '../observability'
import { REDACTED_PLACEHOLDER, createSecretSanitizer } from '../security'
import type { ValidationCheck } from './types'

export function validateObservability(): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  const platform = new ObservabilityPlatform({ enabled: true })
  platform.correlation.createRequestId()
  platform.correlation.setConversationId('rc1-conv')
  const log = platform.logger.info('rc1 observability probe', {
    durationMs: 4,
    status: 'ok',
    fields: { api_key: 'sk-should-redact-aaaaaaaaaaaa', safe: 1 },
  })
  platform.metrics.recordRequest(4)
  platform.metrics.recordConversationStart()
  platform.metrics.recordConversationComplete()
  const trace = platform.tracer.recordLifecycleSkeleton({ conversationId: 'rc1-conv' })
  const health = platform.health.endpointPayloads()
  const alerts = platform.evaluateAlerts()
  const dash = platform.dashboardMarkdown()

  checks.push({
    id: 'obs_logging',
    area: 'observability',
    status: log && log.requestId && log.timestamp ? 'pass' : 'fail',
    summary: 'Structured logging with correlation fields',
  })
  checks.push({
    id: 'obs_no_secrets_in_logs',
    area: 'observability',
    status: JSON.stringify(log).includes(REDACTED_PLACEHOLDER)
      && !JSON.stringify(log).includes('sk-should-redact')
      ? 'pass'
      : 'fail',
    summary: 'Logs redact secrets',
  })
  checks.push({
    id: 'obs_metrics',
    area: 'observability',
    status: platform.metrics.snapshot().requestCount > 0 ? 'pass' : 'fail',
    summary: 'Metrics collector records requests',
  })
  checks.push({
    id: 'obs_tracing',
    area: 'observability',
    status: trace && trace.spans.length >= 5 ? 'pass' : 'fail',
    summary: 'Tracing covers lifecycle domains',
  })
  checks.push({
    id: 'obs_health',
    area: 'observability',
    status: health['/api/health'] ? 'pass' : 'fail',
    summary: 'Health endpoints expose payloads',
  })
  checks.push({
    id: 'obs_correlation',
    area: 'observability',
    status: platform.correlation.current().conversationId === 'rc1-conv' ? 'pass' : 'fail',
    summary: 'Correlation IDs bind conversation context',
  })
  checks.push({
    id: 'obs_alerts',
    area: 'observability',
    status: alerts.length > 0 ? 'pass' : 'fail',
    summary: 'Alert rules evaluate',
  })
  checks.push({
    id: 'obs_dashboard',
    area: 'observability',
    status: dash.includes('Performance Summary') ? 'pass' : 'fail',
    summary: 'Dashboard metrics render',
  })

  // Sanitizer independent probe
  const sanitized = createSecretSanitizer().sanitize({
    Authorization: 'Bearer abcdefghijklmnop',
  })
  checks.push({
    id: 'obs_sanitizer',
    area: 'observability',
    status: JSON.stringify(sanitized).includes(REDACTED_PLACEHOLDER) ? 'pass' : 'fail',
    summary: 'Sanitizer redacts authorization material',
  })

  return checks
}
