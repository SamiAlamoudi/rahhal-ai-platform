/**
 * Sprint 66 — Health dashboard objects from flow results + ops probes.
 */

import { checkHealth, checkLiveness, checkReadiness } from '../observability/health'
import { getOpsMetrics } from '../observability/metricsRegistry'
import type {
  ComponentHealth,
  HealthStatus,
  ProductionHealthDashboard,
  ValidationFlowResult,
  ValidationStepResult,
} from './types'

function worst(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('unhealthy')) return 'unhealthy'
  if (statuses.includes('degraded')) return 'degraded'
  if (statuses.includes('unknown')) return 'unknown'
  return 'healthy'
}

function fromFlow(flow: ValidationFlowResult | undefined, component: string): ComponentHealth {
  const now = new Date().toISOString()
  if (!flow) {
    return {
      component,
      status: 'unknown',
      checks: [],
      summary: 'Flow not run',
      updatedAt: now,
    }
  }
  const failed = flow.steps.filter((s) => s.status === 'fail').length
  const warned = flow.steps.filter((s) => s.status === 'warn').length
  const status: HealthStatus = !flow.ok || failed > 0
    ? 'unhealthy'
    : warned > 0
      ? 'degraded'
      : 'healthy'
  return {
    component,
    status,
    checks: flow.steps,
    summary: flow.ok
      ? `${flow.name} validated (${flow.steps.length} steps)`
      : `${flow.name} failed`,
    updatedAt: now,
  }
}

function opsHealth(): ComponentHealth {
  const live = checkLiveness()
  const ready = checkReadiness({ target: 'development', enforceEnv: false })
  const health = checkHealth({ target: 'development', enforceEnv: false })
  const snap = getOpsMetrics().snapshot()
  const checks: ValidationStepResult[] = [
    {
      id: 'ops.live',
      label: 'Liveness',
      status: live.status === 'ok' ? 'pass' : 'fail',
      detail: live.status,
    },
    {
      id: 'ops.ready',
      label: 'Readiness',
      status: ready.status === 'ok' ? 'pass' : 'warn',
      detail: ready.status,
    },
    {
      id: 'ops.health',
      label: 'Health',
      status: health.status === 'fail' ? 'fail' : health.status === 'degraded' ? 'warn' : 'pass',
      detail: health.status,
    },
  ]
  const status = worst(
    checks.map((c) =>
      c.status === 'fail' ? 'unhealthy' : c.status === 'warn' ? 'degraded' : 'healthy',
    ),
  )
  return {
    component: 'ops',
    status,
    checks,
    summary: `metrics_samples=${snap.recent.length}`,
    updatedAt: new Date().toISOString(),
  }
}

export function buildHealthDashboard(flows: ValidationFlowResult[]): ProductionHealthDashboard {
  const byId = new Map(flows.map((f) => [f.flowId, f]))
  const conversation = fromFlow(byId.get('flow1_conversation_search_ranking'), 'conversation')
  const provider = fromFlow(byId.get('flow6_provider_failure_recovery'), 'provider')
  const booking = fromFlow(byId.get('flow2_booking_trip_documents'), 'booking')
  const trip = fromFlow(byId.get('flow5_multi_booking_timeline'), 'trip')
  const document = fromFlow(byId.get('flow2_booking_trip_documents'), 'document')
  // Enrich document health with flow3 docs step if present
  const flow3 = byId.get('flow3_sync_refresh')
  if (flow3) {
    document.checks = [
      ...document.checks.filter((c) => c.id.startsWith('f2.documents') || c.id.includes('doc')),
      ...flow3.steps.filter((c) => c.id.includes('doc')),
    ]
  }
  const ops = opsHealth()
  const overallStatus = worst([
    conversation.status,
    provider.status,
    booking.status,
    trip.status,
    document.status,
    ops.status,
  ])

  return {
    conversation,
    provider,
    booking,
    trip,
    document,
    overall: {
      component: 'overall',
      status: overallStatus,
      checks: [
        ...conversation.checks.slice(0, 1),
        ...booking.checks.slice(0, 1),
        ...trip.checks.slice(0, 1),
        ...ops.checks,
      ],
      summary:
        overallStatus === 'healthy'
          ? 'Bilamo V1 production validation healthy'
          : `Overall status: ${overallStatus}`,
      updatedAt: new Date().toISOString(),
    },
    generatedAt: new Date().toISOString(),
  }
}
