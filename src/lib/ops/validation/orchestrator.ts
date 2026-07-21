/**
 * Sprint 66 — System Readiness Report + E2E orchestrator.
 */

import { getFeatureRegistry } from '../../ai'
import { checkHealth, checkLiveness, checkReadiness } from '../observability/health'
import { getOpsMetrics } from '../observability/metricsRegistry'
import {
  runFlow1ConversationSearch,
  runFlow2BookingTripDocuments,
  runFlow3SyncRefresh,
  runFlow4Cancellation,
  runFlow5MultiBooking,
  runFlow6ProviderFailure,
  runFlow7FeatureFlags,
} from './flows'
import { buildHealthDashboard } from './healthDashboard'
import {
  SPRINT66_VALIDATION_VERSION,
  type SystemReadinessReport,
  type SystemReadinessSection,
  type ValidationFlowId,
  type ValidationFlowResult,
} from './types'

export type RunProductionValidationOptions = {
  flows?: ValidationFlowId[]
}

const ALL_FLOWS: ValidationFlowId[] = [
  'flow1_conversation_search_ranking',
  'flow2_booking_trip_documents',
  'flow3_sync_refresh',
  'flow4_cancellation',
  'flow5_multi_booking_timeline',
  'flow6_provider_failure_recovery',
  'flow7_feature_flags',
]

async function runSelectedFlow(id: ValidationFlowId): Promise<ValidationFlowResult> {
  switch (id) {
    case 'flow1_conversation_search_ranking':
      return runFlow1ConversationSearch()
    case 'flow2_booking_trip_documents':
      return runFlow2BookingTripDocuments()
    case 'flow3_sync_refresh':
      return runFlow3SyncRefresh()
    case 'flow4_cancellation':
      return runFlow4Cancellation()
    case 'flow5_multi_booking_timeline':
      return runFlow5MultiBooking()
    case 'flow6_provider_failure_recovery':
      return runFlow6ProviderFailure()
    case 'flow7_feature_flags':
      return runFlow7FeatureFlags()
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

function section(
  id: string,
  name: string,
  ok: boolean,
  notes: string[],
  metrics?: SystemReadinessSection['metrics'],
  status?: SystemReadinessSection['status'],
): SystemReadinessSection {
  return {
    id,
    name,
    ok,
    status: status ?? (ok ? 'healthy' : 'unhealthy'),
    notes,
    metrics,
  }
}

export function buildSystemReadinessReport(
  flows: ValidationFlowResult[],
): SystemReadinessReport {
  const dashboard = buildHealthDashboard(flows)
  const byId = new Map(flows.map((f) => [f.flowId, f]))
  const flags = getFeatureRegistry()
  const metricsSnap = getOpsMetrics().snapshot()
  const live = checkLiveness()
  const ready = checkReadiness({ target: 'development', enforceEnv: false })
  const health = checkHealth({ target: 'development', enforceEnv: false })

  const sections: SystemReadinessSection[] = [
    section(
      'conversation',
      'Conversation',
      byId.get('flow1_conversation_search_ranking')?.ok ?? false,
      ['Destination understanding + BI search/rank/recommend'],
      { durationMs: byId.get('flow1_conversation_search_ranking')?.durationMs ?? 0 },
    ),
    section(
      'search',
      'Search',
      (byId.get('flow1_conversation_search_ranking')?.steps.some((s) => s.id === 'f1.search' && s.status === 'pass'))
        ?? false,
      ['Booking Intelligence simulated search'],
    ),
    section(
      'booking',
      'Booking',
      byId.get('flow2_booking_trip_documents')?.ok ?? false,
      ['Booking Execution with simulated providers'],
    ),
    section(
      'trips',
      'Trips',
      (byId.get('flow5_multi_booking_timeline')?.ok && byId.get('flow3_sync_refresh')?.ok) ?? false,
      ['Trip Management create/sync/refresh/multi-booking'],
    ),
    section(
      'documents',
      'Documents',
      byId.get('flow2_booking_trip_documents')?.steps.some((s) => s.id === 'f2.documents' && s.status === 'pass')
        ?? false,
      ['Legacy DocumentCenter via Booking Execution / Trip Management'],
    ),
    section(
      'providers',
      'Providers',
      byId.get('flow6_provider_failure_recovery')?.ok ?? false,
      ['Failure normalization, retry, simulated fallback'],
    ),
    section(
      'metrics',
      'Metrics',
      true,
      ['Ops metrics registry reachable'],
      {
        samples: metricsSnap.recent.length,
        counterKeys: Object.keys(metricsSnap.counters).length,
      },
      'healthy',
    ),
    section(
      'security',
      'Security',
      live.status === 'ok' && ready.status !== 'fail',
      ['Liveness/readiness probes; production env gates remain mock-payment safe'],
      { liveness: live.status, readiness: ready.status, health: health.status },
      ready.status === 'fail' ? 'degraded' : 'healthy',
    ),
    section(
      'recovery',
      'Recovery',
      byId.get('flow6_provider_failure_recovery')?.ok ?? false,
      ['Retry + fallback validated in Flow 6'],
    ),
    section(
      'feature_flags',
      'Feature Flags',
      byId.get('flow7_feature_flags')?.ok ?? false,
      [
        `booking_intelligence=${flags.isEnabled('ai.booking_intelligence')}`,
        `live_providers=${flags.isEnabled('ai.live_providers')}`,
      ],
    ),
  ]

  const flowsPassed = flows.filter((f) => f.ok).length
  const flowsFailed = flows.filter((f) => !f.ok).length
  const totalSteps = flows.reduce((n, f) => n + f.steps.length, 0)
  const passedSteps = flows.reduce(
    (n, f) => n + f.steps.filter((s) => s.status === 'pass' || s.status === 'skip' || s.status === 'warn').length,
    0,
  )

  const productionValidated =
    flowsFailed === 0
    && sections.filter((s) => ['conversation', 'booking', 'trips', 'documents', 'providers', 'feature_flags'].includes(s.id))
      .every((s) => s.ok)

  return {
    generatedAt: new Date().toISOString(),
    version: SPRINT66_VALIDATION_VERSION,
    productionValidated,
    sections,
    flows,
    dashboard,
    summary: {
      flowsPassed,
      flowsFailed,
      flowsSkipped: 0,
      totalSteps,
      passedSteps,
    },
  }
}

/** Run all (or selected) E2E production validation flows. */
export async function runProductionValidation(
  options: RunProductionValidationOptions = {},
): Promise<SystemReadinessReport> {
  const ids = options.flows ?? ALL_FLOWS
  const flows: ValidationFlowResult[] = []
  for (const id of ids) {
    flows.push(await runSelectedFlow(id))
  }
  return buildSystemReadinessReport(flows)
}

export { ALL_FLOWS }
