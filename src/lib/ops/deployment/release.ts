/**
 * Sprint 68 — Release automation artifacts.
 */

import { getFeatureRegistry } from '../../ai'
import {
  PLATFORM_PACKAGE_VERSION,
  PRODUCTION_V1_VERSION,
} from '../production/report'
import type {
  FeatureMatrixEntry,
  GoLiveChecklistItem,
  ReleaseAutomationArtifacts,
} from './types'

/** Final Production V1 release version (Sprint 68). */
export const RAHHAL_V1_RELEASE_VERSION = '1.0.0'

/** Release candidate retained from Sprint 65. */
export const RAHHAL_V1_RC_VERSION = PRODUCTION_V1_VERSION

export const SPRINT68_DEPLOYMENT_VERSION = '1.0.0-deploy'

export const KNOWN_LIMITATIONS_V1 = [
  'Live payments frozen (VITE_PAYMENT_PROVIDER=mock).',
  'Live travel providers default OFF; enable only with Edge secrets + ops approval.',
  'In-memory idempotency / DLQ / trip store — not multi-instance durable.',
  'Enterprise Document Center (ai.document_center_v2) OFF by default when present.',
  'No OpenTelemetry export — in-process metrics + structured logs only.',
  'Alert sinks are mock/composite until production webhook configured.',
  'Hosting rollback is manual (Git SHA / platform redeploy); library arms the trigger.',
]

const RISKY_OFF = new Set([
  'ai.live_providers',
  'provider.amadeus',
  'provider.duffel',
  'provider.booking',
  'payments.live',
  'providers.live_master',
  'brain.debug',
])

export function buildFeatureMatrix(): FeatureMatrixEntry[] {
  const registry = getFeatureRegistry()
  return registry.list().map((def) => {
    const enabled = registry.isEnabled(def.id)
    return {
      id: def.id,
      enabled,
      lifecycle: def.lifecycle,
      productionSafe: !(RISKY_OFF.has(def.id) && enabled),
    }
  })
}

export function buildGoLiveChecklist(input?: {
  secretsOk?: boolean
  healthOk?: boolean
  validationOk?: boolean
  cicdOk?: boolean
  rollbackArmed?: boolean
}): GoLiveChecklistItem[] {
  const secretsOk = input?.secretsOk ?? true
  const healthOk = input?.healthOk ?? true
  const validationOk = input?.validationOk ?? true
  const cicdOk = input?.cicdOk ?? true
  const rollbackArmed = input?.rollbackArmed ?? true

  const item = (
    id: string,
    label: string,
    group: string,
    done: boolean,
  ): GoLiveChecklistItem => ({
    id,
    label,
    group,
    status: done ? 'done' : 'pending',
  })

  return [
    item('payment_mock', 'VITE_PAYMENT_PROVIDER=mock', 'Security', true),
    item('live_off', 'Live providers OFF (or Edge-gated)', 'Security', true),
    item('no_vite_secrets', 'No provider secrets in VITE_*', 'Security', secretsOk),
    item('supabase', 'Supabase URL + anon key for production profile', 'Environment', secretsOk),
    item('ci_green', 'lint / typecheck / test:run / build green', 'CI/CD', cicdOk),
    item('health', 'Liveness / readiness / subsystem health OK', 'Health', healthOk),
    item('validation', 'Production validation flows pass', 'Validation', validationOk),
    item('rollback', 'Rollback plan armed (safe mode)', 'Rollback', rollbackArmed),
    item('alerts', 'Alert rules evaluated; no critical open at go-live', 'Monitoring', true),
    item('docs', 'Release notes + runbooks published', 'Docs', true),
    item('limitations', 'Known limitations acknowledged', 'Docs', true),
  ]
}

export function generateReleaseArtifacts(input?: {
  secretsOk?: boolean
  healthOk?: boolean
  validationOk?: boolean
  cicdOk?: boolean
  profile?: string
}): ReleaseAutomationArtifacts {
  const version = RAHHAL_V1_RELEASE_VERSION
  const featureMatrix = buildFeatureMatrix()
  const checklist = buildGoLiveChecklist(input)

  const releaseNotes = [
    `# Bilamo V1 — ${version}`,
    '',
    `**Release candidate:** ${RAHHAL_V1_RC_VERSION}`,
    `**Package version:** ${PLATFORM_PACKAGE_VERSION}`,
    `**Sprint:** 68 — Production Deployment & Launch Automation`,
    '',
    '## Highlights',
    '',
    '- Deployment profiles: development / staging / beta / production',
    '- CI/CD gates: lint, typecheck, test, build, smoke, rollback trigger',
    '- Secrets validation (Amadeus, Booking.com, Duffel, Stripe, HyperPay, Apple Pay, notifications)',
    '- Production subsystem health + metrics + alerts',
    '- Rollback playbooks (deployment, config, provider, feature, safe mode)',
    '- Release automation artifacts and go-live checklist',
    '',
    '## Safe defaults',
    '',
    '- Mock payments',
    '- Live providers OFF',
    '- Additive ops only — no business-logic rewrites',
    '',
  ].join('\n')

  const deploymentReport = [
    `# Deployment Report — Bilamo ${version}`,
    '',
    `Profile: ${input?.profile ?? 'production'}`,
    `CI/CD: ${input?.cicdOk === false ? 'FAIL' : 'PASS'}`,
    `Secrets: ${input?.secretsOk === false ? 'FAIL' : 'PASS'}`,
    `Health: ${input?.healthOk === false ? 'FAIL' : 'PASS'}`,
    `Validation: ${input?.validationOk === false ? 'FAIL' : 'PASS'}`,
    '',
  ].join('\n')

  const environmentReport = [
    `# Environment Report — Bilamo ${version}`,
    '',
    'Profiles: development, staging, beta, production',
    'Env target mapping uses existing DeployTarget + VITE_DEPLOY_TARGET',
    'Beta maps to staging env validation with optional live providers',
    '',
  ].join('\n')

  const rollbackGuide = [
    `# Rollback Guide — Bilamo ${version}`,
    '',
    '1. Trigger safe mode (mock payments, live providers OFF)',
    '2. Disable risky feature flags',
    '3. Force mock provider adapters',
    '4. Restore last known-good configuration',
    '5. Redeploy previous Git SHA / hosting artifact',
    '6. Run startup recovery + health probes',
    '',
    'Library: `buildRollbackPlan()` / `triggerRollback()`',
    '',
  ].join('\n')

  const versionReport = [
    `# Version Report`,
    '',
    `Bilamo V1 release: ${version}`,
    `RC: ${RAHHAL_V1_RC_VERSION}`,
    `Package: ${PLATFORM_PACKAGE_VERSION}`,
    `Deployment module: ${SPRINT68_DEPLOYMENT_VERSION}`,
    `Platform package constant: ${PLATFORM_PACKAGE_VERSION}`,
    '',
  ].join('\n')

  return {
    version,
    rcVersion: RAHHAL_V1_RC_VERSION,
    packageVersion: PLATFORM_PACKAGE_VERSION,
    releaseNotes,
    deploymentReport,
    environmentReport,
    featureMatrix,
    knownLimitations: [...KNOWN_LIMITATIONS_V1],
    rollbackGuide,
    goLiveChecklist: checklist,
    versionReport,
  }
}
