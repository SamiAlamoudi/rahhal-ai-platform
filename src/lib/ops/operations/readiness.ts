/**
 * Sprint 69 — Final beta operations readiness + go/no-go.
 */

import { generateBetaReadinessReport } from '../beta'
import { buildProductionOpsDashboard } from './dashboards'
import { buildEnvironmentReport, detectOpsEnvironment } from './environment'
import { listOpenOpsIncidents } from './incidents'
import { collectNotificationMonitorMetrics } from './notificationMonitoring'
import { collectPaymentMonitorMetrics } from './paymentMonitoring'
import { buildProviderStatusReport } from './providerMonitoring'
import { generateOperationalReport } from './reports'
import { runOperationsSmokeTests } from './smoke'
import { collectOperationalAnalytics } from './analytics'
import type {
  BetaOperationsReadinessReport,
  GoNoGoDecision,
  OpsEnvironment,
} from './types'

export const SPRINT69_OPERATIONS_VERSION = '1.0.0-ops'

export function computeBetaOpsReadinessScore(input: {
  environmentOk: boolean
  smokeOk: boolean
  dashboardOk: boolean
  providersOk: boolean
  paymentsOk: boolean
  notificationsOk: boolean
  betaReady: boolean
  openIncidents: number
}): number {
  const weights = [
    input.environmentOk,
    input.smokeOk,
    input.dashboardOk,
    input.providersOk,
    input.paymentsOk,
    input.notificationsOk,
    input.betaReady,
    input.openIncidents === 0,
  ]
  return Math.round((weights.filter(Boolean).length / weights.length) * 100)
}

export function decideGoNoGo(score: number, openIncidents: number): GoNoGoDecision {
  if (openIncidents > 0 && score < 90) return 'no_go'
  if (score >= 90) return 'go'
  if (score >= 75) return 'conditional_go'
  return 'no_go'
}

export async function generateBetaOperationsReadinessReport(input?: {
  environment?: OpsEnvironment
  skipE2E?: boolean
}): Promise<BetaOperationsReadinessReport> {
  const environment = input?.environment ?? detectOpsEnvironment({ explicit: 'beta' })
  const environmentReport = buildEnvironmentReport(environment, {
    env: {
      VITE_PAYMENT_PROVIDER: 'mock',
      VITE_LIVE_PROVIDERS_ENABLED: 'false',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJub25lIn0.e30.',
    },
  })
  const dashboard = buildProductionOpsDashboard(environment)
  const providerStatus = buildProviderStatusReport(environment)
  const payments = collectPaymentMonitorMetrics(environment)
  const notifications = collectNotificationMonitorMetrics()
  const analytics = collectOperationalAnalytics(environment)
  const smoke = await runOperationsSmokeTests(environment, { skipE2E: input?.skipE2E })
  const beta = generateBetaReadinessReport({
    environment: environment as 'beta',
    smoke: { ok: smoke.ok, flowsPassed: smoke.checks.filter((c) => c.ok).length, flowsFailed: smoke.checks.filter((c) => !c.ok).length },
  })
  const operationsReport = generateOperationalReport('system', environment)
  const openIncidents = listOpenOpsIncidents().length

  const readinessScore = computeBetaOpsReadinessScore({
    environmentOk: environmentReport.ok,
    smokeOk: smoke.ok,
    dashboardOk: dashboard.overall !== 'unhealthy',
    providersOk: providerStatus.overall !== 'unhealthy',
    paymentsOk: payments.some((p) => p.providerId === 'mock'),
    notificationsOk: notifications.every((n) => n.queueHealth !== 'unhealthy'),
    betaReady: beta.betaReady,
    openIncidents,
  })

  const decision = decideGoNoGo(readinessScore, openIncidents)
  const betaReady = decision === 'go' || (decision === 'conditional_go' && beta.betaReady)
  const recommendation =
    decision === 'go'
      ? 'Rahhal Beta Ready — proceed with beta operations'
      : decision === 'conditional_go'
        ? 'Conditional go — monitor providers and keep mock payments'
        : 'No-go — resolve failing ops gates before beta traffic'

  return {
    ok: decision !== 'no_go',
    betaReady,
    readinessScore,
    decision,
    recommendation,
    environment,
    environmentReport,
    dashboard,
    providerStatus,
    payments,
    notifications,
    analytics,
    smoke,
    operationsReport,
    openIncidents,
    generatedAt: new Date().toISOString(),
    version: SPRINT69_OPERATIONS_VERSION,
  }
}

export async function runBetaOperationsPreflight(input?: {
  skipE2E?: boolean
}): Promise<BetaOperationsReadinessReport> {
  return generateBetaOperationsReadinessReport({
    environment: 'beta',
    skipE2E: input?.skipE2E,
  })
}
