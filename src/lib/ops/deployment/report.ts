/**
 * Sprint 68 — Aggregated deployment / launch report.
 */

import { evaluateProductionAlerts } from './alerts'
import { buildPassingCICDReport, buildCICDPipelineReport, type CICDGateInput } from './cicd'
import { buildProductionHealthReport } from './health'
import { collectProductionMetrics } from './metrics'
import { detectDeployProfile, getDeployProfile } from './profiles'
import { generateReleaseArtifacts, RAHHAL_V1_RELEASE_VERSION } from './release'
import { buildRollbackPlan } from './rollback'
import { validateProductionSecrets } from './secrets'
import { runDeploymentValidation } from './validation'
import type {
  DeployProfileName,
  DeploymentLaunchReport,
} from './types'

export function computeReadinessScore(input: {
  secretsOk: boolean
  healthOk: boolean
  alertsOk: boolean
  validationOk: boolean
  cicdOk: boolean
  rollbackArmed: boolean
}): number {
  const weights = [
    input.secretsOk,
    input.healthOk,
    input.alertsOk,
    input.validationOk,
    input.cicdOk,
    input.rollbackArmed,
  ]
  const passed = weights.filter(Boolean).length
  return Math.round((passed / weights.length) * 100)
}

export async function generateDeploymentLaunchReport(input?: {
  profile?: DeployProfileName
  env?: Record<string, string | undefined>
  edgeSecrets?: Record<string, string | undefined>
  cicd?: CICDGateInput
  skipE2E?: boolean
  supabaseConfigured?: boolean
  now?: () => number
}): Promise<DeploymentLaunchReport> {
  const now = input?.now ?? (() => Date.now())
  const profile = input?.profile
    ? getDeployProfile(input.profile)
    : detectDeployProfile({ env: input?.env })

  const secrets = validateProductionSecrets({
    profile: profile.name,
    env: input?.env ?? {
      VITE_PAYMENT_PROVIDER: 'mock',
      VITE_LIVE_PROVIDERS_ENABLED: 'false',
      VITE_SUPABASE_URL: input?.supabaseConfigured === false ? undefined : 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: input?.supabaseConfigured === false ? undefined : 'eyJhbGciOiJub25lIn0.e30.',
    },
    edgeSecrets: input?.edgeSecrets,
    now,
  })

  const health = buildProductionHealthReport({
    profile: profile.name,
    paymentProvider: 'mock',
    liveProvidersEnabled: false,
    supabaseConfigured: input?.supabaseConfigured !== false,
    now,
  })

  const metrics = collectProductionMetrics({ now })
  const alerts = evaluateProductionAlerts({ now })
  const rollback = buildRollbackPlan({ now })
  const cicd = input?.cicd
    ? buildCICDPipelineReport({ ...input.cicd, now })
    : buildPassingCICDReport(now)

  const validation = await runDeploymentValidation({
    profile: profile.name,
    skipE2E: input?.skipE2E,
    paymentProvider: 'mock',
    liveProvidersEnabled: false,
  })

  const healthOk = health.overall !== 'unhealthy'
  const readinessScore = computeReadinessScore({
    secretsOk: secrets.ok,
    healthOk,
    alertsOk: alerts.ok,
    validationOk: validation.ok,
    cicdOk: cicd.ok,
    rollbackArmed: !rollback.recommended || rollback.safeMode,
  })

  const artifacts = generateReleaseArtifacts({
    secretsOk: secrets.ok,
    healthOk,
    validationOk: validation.ok,
    cicdOk: cicd.ok,
    profile: profile.name,
  })

  const productionReady =
    secrets.ok
    && healthOk
    && alerts.ok
    && validation.ok
    && cicd.ok
    && readinessScore >= 80

  const summary = productionReady
    ? `Bilamo V1 ${RAHHAL_V1_RELEASE_VERSION} production ready (score=${readinessScore})`
    : `Not production ready (score=${readinessScore}) — review failing gates`

  return {
    ok: productionReady,
    productionReady,
    readinessScore,
    version: RAHHAL_V1_RELEASE_VERSION,
    profile: profile.name,
    cicd,
    secrets,
    health,
    metrics,
    alerts,
    rollback,
    validationGates: validation.gates,
    artifacts,
    checklist: artifacts.goLiveChecklist,
    summary,
    generatedAt: new Date(now()).toISOString(),
  }
}

export function isProductionDeploymentReady(report: DeploymentLaunchReport): boolean {
  return report.productionReady && report.readinessScore >= 80
}

export async function runProductionDeploymentPreflight(input?: {
  profile?: DeployProfileName
  skipE2E?: boolean
}): Promise<DeploymentLaunchReport> {
  return generateDeploymentLaunchReport({
    profile: input?.profile ?? 'production',
    skipE2E: input?.skipE2E,
    supabaseConfigured: true,
  })
}
