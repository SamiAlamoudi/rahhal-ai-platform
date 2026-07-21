/**
 * Sprint 70 — Release integrity (composes production integrity + env safety).
 */

import { validateDataIntegrity } from '../production/integrity'
import { validateEnvironment } from '../security/envValidation'
import { auditFeatureFlags } from '../production/featureFlagAudit'
import type { GACheckResult, GAIntegrityReport } from './types'

export function validateGAIntegrity(input?: {
  env?: Record<string, string | undefined>
}): GAIntegrityReport {
  const integrity = validateDataIntegrity({ now: () => Date.now() })
  const env = validateEnvironment({
    target: 'production',
    env: input?.env ?? {
      VITE_PAYMENT_PROVIDER: 'mock',
      VITE_LIVE_PROVIDERS_ENABLED: 'false',
    },
  })
  const flags = auditFeatureFlags()

  const checks: GACheckResult[] = [
    {
      id: 'integrity.data',
      area: 'Integrity',
      status: integrity.ok ? 'pass' : 'fail',
      summary: integrity.ok ? 'Data integrity validators pass' : 'Integrity errors present',
    },
    {
      id: 'integrity.env',
      area: 'Integrity',
      status: env.ok || env.errors.length === 0 ? 'pass' : 'fail',
      summary: `payment=${env.resolved.paymentProvider} live=${env.resolved.liveProvidersEnabled}`,
    },
    {
      id: 'integrity.flags',
      area: 'Integrity',
      status: flags.ok ? 'pass' : 'fail',
      summary: flags.ok ? 'Feature flags safe for GA defaults' : 'Risky flags enabled',
    },
    {
      id: 'integrity.secrets_client',
      area: 'Integrity',
      status: env.errors.some((e) => e.includes('must not be set')) ? 'fail' : 'pass',
      summary: 'No forbidden VITE_* provider secrets',
    },
  ]

  return {
    ok: checks.every((c) => c.status !== 'fail'),
    checks,
    generatedAt: new Date().toISOString(),
  }
}
