/**
 * Sprint 67 — production configuration diagnostics for beta.
 */

import { validateEnvironment } from '../security/envValidation'
import { auditProductionConfig } from '../production/configAudit'
import { getFeatureRegistry } from '../../ai/featureFlags'
import { getBetaEnvironmentProfile, readBetaEnv } from './config'
import { auditBetaSecrets } from './secrets'
import { buildBetaProviderMatrix } from './providers'
import { assertBetaPaymentsSafe, buildBetaPaymentMatrix } from './payments'
import type { BetaCheckResult, BetaEnvironment, BetaEnvironmentProfile } from './types'

export function runBetaConfigDiagnostics(input?: {
  environment?: BetaEnvironment
}): {
  ok: boolean
  profile: BetaEnvironmentProfile
  checks: BetaCheckResult[]
  diagnostics: Record<string, string | boolean | number>
} {
  const profile = getBetaEnvironmentProfile(input?.environment)
  const checks: BetaCheckResult[] = []
  const env = validateEnvironment({
    target: profile.deployTarget,
    paymentProvider: readBetaEnv('VITE_PAYMENT_PROVIDER') ?? 'mock',
    liveProvidersEnabled: readBetaEnv('VITE_LIVE_PROVIDERS_ENABLED') === 'true',
  })
  checks.push({
    id: 'cfg.env',
    area: 'Configuration',
    status: env.ok ? 'pass' : env.errors.length ? 'fail' : 'warn',
    summary: env.ok ? 'Environment valid' : env.errors.join('; ') || env.warnings.join('; '),
    details: { errors: env.errors, warnings: env.warnings },
  })

  const configAudit = auditProductionConfig({
    target: profile.deployTarget,
    paymentProvider: readBetaEnv('VITE_PAYMENT_PROVIDER') ?? 'mock',
  })
  checks.push({
    id: 'cfg.production_audit',
    area: 'Configuration',
    status: configAudit.ok ? 'pass' : 'fail',
    summary: configAudit.ok ? 'Production config audit OK' : configAudit.errors.join('; '),
  })

  const secrets = auditBetaSecrets({
    requireProviderSecrets: false,
  })
  checks.push({
    id: 'cfg.secrets',
    area: 'Configuration',
    status: secrets.exposedRisks.length === 0 ? 'pass' : 'fail',
    summary: `present=${secrets.present.length} missing_optional=${secrets.missing.length}`,
  })

  const pay = assertBetaPaymentsSafe(profile)
  checks.push({
    id: 'cfg.payments',
    area: 'Configuration',
    status: pay.ok ? 'pass' : 'fail',
    summary: pay.ok ? `payment=${pay.paymentProvider}` : pay.error!,
  })

  const flags = getFeatureRegistry()
  checks.push({
    id: 'cfg.feature_flags',
    area: 'Configuration',
    status: 'pass',
    summary: `live_providers=${flags.isEnabled('ai.live_providers')} booking_execution=${flags.isEnabled('ai.booking_execution')}`,
  })

  const providers = buildBetaProviderMatrix(profile)
  const payments = buildBetaPaymentMatrix(profile)
  const liveEligible = providers.filter((p) => p.mode === 'live').length

  const diagnostics: Record<string, string | boolean | number> = {
    environment: profile.environment,
    deployTarget: profile.deployTarget,
    paymentProvider: pay.paymentProvider,
    liveProvidersAllowed: profile.liveProvidersAllowed,
    mockPaymentsRequired: profile.mockPaymentsRequired,
    liveEligibleProviders: liveEligible,
    paymentSlots: payments.length,
    supabaseConfigured: env.resolved.supabaseConfigured,
  }

  const ok = checks.every((c) => c.status !== 'fail')
  return { ok, profile, checks, diagnostics }
}
