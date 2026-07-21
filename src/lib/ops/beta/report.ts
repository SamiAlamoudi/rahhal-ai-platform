/**
 * Sprint 67 — Beta readiness report + launch orchestration.
 */

import { runBetaConfigDiagnostics } from './diagnostics'
import { getBetaEnvironmentProfile, resolveBetaEnvironment } from './config'
import { auditBetaSecrets } from './secrets'
import { buildBetaProviderMatrix, configureBetaLiveProviders } from './providers'
import { buildBetaPaymentMatrix, createBetaPaymentRegistry } from './payments'
import { buildBetaNotificationMatrix, createProductionNotificationLayer } from './notifications'
import { enableBetaObservability, snapshotBetaMetrics } from './observability'
import { runBetaSecurityValidation } from './security'
import { runBetaSmokeTests } from './smoke'
import {
  BETA_LAUNCH_VERSION,
  type BetaEnvironment,
  type BetaReadinessReport,
} from './types'

export function generateBetaReadinessReport(input?: {
  environment?: BetaEnvironment
  includeSmoke?: boolean
  smoke?: { ok: boolean; flowsPassed: number; flowsFailed: number }
}): BetaReadinessReport {
  const environment = resolveBetaEnvironment(input?.environment)
  const profile = getBetaEnvironmentProfile(environment)
  const diagnostics = runBetaConfigDiagnostics({ environment })
  const secrets = auditBetaSecrets()
  const providers = buildBetaProviderMatrix(profile)
  const payments = buildBetaPaymentMatrix(profile)
  const notifications = buildBetaNotificationMatrix()
  const security = runBetaSecurityValidation()

  const checks = [...diagnostics.checks, ...security.checks]
  if (input?.smoke) {
    checks.push({
      id: 'smoke.e2e',
      area: 'Smoke',
      status: input.smoke.ok ? 'pass' : 'fail',
      summary: `passed=${input.smoke.flowsPassed} failed=${input.smoke.flowsFailed}`,
    })
  }

  const betaReady =
    diagnostics.ok
    && security.ok
    && secrets.exposedRisks.length === 0
    && (input?.smoke ? input.smoke.ok : true)

  return {
    generatedAt: new Date().toISOString(),
    version: BETA_LAUNCH_VERSION,
    environment,
    betaReady,
    profile,
    secrets,
    providers,
    payments,
    notifications,
    checks,
    diagnostics: diagnostics.diagnostics,
    smoke: input?.smoke,
  }
}

export async function runBetaLaunchValidation(input?: {
  environment?: BetaEnvironment
  runSmoke?: boolean
  activateLiveProviders?: boolean
}): Promise<BetaReadinessReport> {
  if (input?.activateLiveProviders) {
    configureBetaLiveProviders({ enableMaster: true })
  }
  const obs = enableBetaObservability()
  try {
    let smoke: BetaReadinessReport['smoke']
    if (input?.runSmoke !== false) {
      const result = await runBetaSmokeTests()
      smoke = {
        ok: result.ok,
        flowsPassed: result.flowsPassed,
        flowsFailed: result.flowsFailed,
      }
    }
    const report = generateBetaReadinessReport({
      environment: input?.environment,
      smoke,
    })
    const metrics = snapshotBetaMetrics()
    report.diagnostics = {
      ...report.diagnostics,
      metricSamples: metrics.samples,
      correlationId: obs.correlationId,
    }
    return report
  } finally {
    obs.dispose()
  }
}

export {
  createBetaPaymentRegistry,
  createProductionNotificationLayer,
  configureBetaLiveProviders,
  getBetaEnvironmentProfile,
  resolveBetaEnvironment,
}
